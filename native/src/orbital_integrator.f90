module orbital_integrator
  ! Advances the system with Velocity Verlet (2nd order, symplectic), Yoshida
  ! (4th order, symplectic composition of three Verlet substeps) or classic RK4
  ! (4th order, not symplectic). dt may be negative to integrate backwards in time.
  ! Velocity-dependent forces (drag, 1PN) are evaluated with a predicted velocity
  ! inside each Verlet substep and refreshed at its end; the scheme is then no
  ! longer symplectic. Caller state is copied back only when the call succeeds.
  use iso_c_binding, only: c_int, c_double
  use, intrinsic :: ieee_arithmetic, only: ieee_is_finite
  use orbital_types, only: os_options, os_report, os_event, integrator_verlet, &
    integrator_yoshida4, integrator_rk4, event_collision, event_periapsis, event_apoapsis, event_escape
  use orbital_forces, only: validate_system, total_accelerations, uses_velocity, central_body, &
    all_finite
  implicit none
  private
  public :: advance_system

  real(c_double), parameter :: pi = acos(-1.0_c_double)
  real(c_double), parameter :: cube_root_two = 2.0_c_double ** (1.0_c_double / 3.0_c_double)
  real(c_double), parameter :: yoshida_outer = 1.0_c_double / (2.0_c_double - cube_root_two)
  real(c_double), parameter :: yoshida_inner = -cube_root_two / (2.0_c_double - cube_root_two)
  ! Periapsis/apoapsis are reported only for orbits at least this eccentric, so
  ! round-off in near-circular orbits does not produce spurious turning points.
  real(c_double), parameter :: event_min_eccentricity = 1.0e-2_c_double
  real(c_double), parameter :: radial_tolerance = 1.0e-12_c_double
  ! Suggested step resolves the shortest dynamical time with ~200 steps per orbit.
  real(c_double), parameter :: steps_per_orbit = 200.0_c_double

contains

  subroutine advance_system(n, mass, radius, drag, active, pos, vel, acc, acc_ready, dt, &
                            grav, eps, steps, options, report, events, event_capacity, status)
    integer(c_int), intent(in) :: n, acc_ready, steps, event_capacity
    real(c_double), intent(inout) :: mass(n), radius(n), pos(3,n), vel(3,n), acc(3,n)
    real(c_double), intent(in) :: drag(n), dt, grav, eps
    integer(c_int), intent(inout) :: active(n)
    type(os_options), intent(in) :: options
    type(os_report), intent(inout) :: report
    type(os_event), intent(inout) :: events(*)
    integer(c_int), intent(out) :: status

    real(c_double), allocatable :: w_mass(:), w_radius(:), w_pos(:,:), w_vel(:,:), w_acc(:,:)
    real(c_double), allocatable :: stage(:,:,:), previous_radial(:)
    logical, allocatable :: previous_bound(:)
    integer(c_int), allocatable :: w_active(:)
    type(os_event), allocatable :: found(:)
    integer :: allocation_status, step_index, reference
    integer(c_int) :: event_count, events_dropped, collision_count
    real(c_double) :: min_r2, min_tau2, min_tau2_massive, direction
    logical :: velocity_dependent, merged

    call validate_system(n, mass, radius, drag, active, pos, vel, dt, grav, eps, steps, &
                         options, status)
    if (status /= 0_c_int) return
    status = 1_c_int
    if (event_capacity < 0) return

    ! Velocity Verlet and Yoshida use stages 1-2 (velocity-dependent forces); only RK4 needs all 8.
    allocate(w_mass(n), w_radius(n), w_pos(3,n), w_vel(3,n), w_acc(3,n), &
      stage(3,n,merge(8, 2, options%integrator == integrator_rk4)), &
      previous_radial(n), previous_bound(n), w_active(n), found(max(1, event_capacity)), &
      stat=allocation_status)
    if (allocation_status /= 0) then
      status = 4_c_int
      return
    end if
    w_mass = mass
    w_radius = radius
    w_active = active
    w_pos = pos
    w_vel = vel
    velocity_dependent = uses_velocity(options)
    direction = sign(1.0_c_double, dt)
    min_r2 = huge(1.0_c_double)
    min_tau2 = huge(1.0_c_double)
    min_tau2_massive = huge(1.0_c_double)
    event_count = 0_c_int
    events_dropped = 0_c_int
    collision_count = 0_c_int
    status = 0_c_int

    if (acc_ready /= 0_c_int) then
      w_acc = acc
      if (.not. all_finite(n, w_acc)) then
        status = 1_c_int
        return
      end if
    else
      call evaluate(w_pos, w_vel, w_acc)
      if (status /= 0_c_int) return
    end if
    reference = reference_body()
    call reset_event_state()

    do step_index = 1, steps
      select case (options%integrator)
      case (integrator_verlet)
        call verlet_substep(dt)
      case (integrator_yoshida4)
        call verlet_substep(yoshida_outer * dt)
        if (status == 0_c_int) call verlet_substep(yoshida_inner * dt)
        if (status == 0_c_int) call verlet_substep(yoshida_outer * dt)
      case default
        call rk4_step(dt)
      end select
      if (status /= 0_c_int) return

      if (options%collisions == 1_c_int) then
        call resolve_collisions(step_index, merged)
        if (merged) then
          call evaluate(w_pos, w_vel, w_acc)
          if (status /= 0_c_int) return
        end if
      end if
      call detect_events(step_index)
    end do

    mass = w_mass
    radius = w_radius
    active = w_active
    pos = w_pos
    vel = w_vel
    acc = w_acc
    if (event_count > 0) events(1:event_count) = found(1:event_count)
    report%event_count = event_count
    report%events_dropped = events_dropped
    report%collisions = collision_count
    report%reserved = 0_c_int
    report%min_separation_m = -1.0_c_double
    report%min_dynamical_time_s = -1.0_c_double
    report%suggested_time_step_s = -1.0_c_double
    report%massive_suggested_time_step_s = -1.0_c_double
    if (min_r2 < huge(1.0_c_double)) report%min_separation_m = sqrt(min_r2)
    if (min_tau2 < huge(1.0_c_double)) then
      report%min_dynamical_time_s = sqrt(min_tau2)
      report%suggested_time_step_s = 2.0_c_double * pi * report%min_dynamical_time_s / &
        steps_per_orbit
    end if
    if (min_tau2_massive < huge(1.0_c_double)) report%massive_suggested_time_step_s = &
      2.0_c_double * pi * sqrt(min_tau2_massive) / steps_per_orbit

  contains

    subroutine evaluate(p, v, a)
      real(c_double), intent(in) :: p(3,n), v(3,n)
      real(c_double), intent(out) :: a(3,n)
      call total_accelerations(n, w_mass, drag, w_active, p, v, grav, eps, options, a, &
                               status, min_r2, min_tau2, min_tau2_massive)
    end subroutine

    ! Kick-drift-kick Verlet substep of length h, reusing w_acc as a(t).
    subroutine verlet_substep(h)
      real(c_double), intent(in) :: h
      w_pos = w_pos + h * w_vel + 0.5_c_double * h * h * w_acc
      if (.not. all_finite(n, w_pos)) then
        status = 3_c_int
        return
      end if
      if (velocity_dependent) then
        stage(:,:,1) = w_vel + h * w_acc
        call evaluate(w_pos, stage(:,:,1), stage(:,:,2))
      else
        call evaluate(w_pos, w_vel, stage(:,:,2))
      end if
      if (status /= 0_c_int) return
      w_vel = w_vel + 0.5_c_double * h * (w_acc + stage(:,:,2))
      if (.not. all_finite(n, w_vel)) then
        status = 3_c_int
        return
      end if
      if (velocity_dependent) then
        call evaluate(w_pos, w_vel, w_acc)
      else
        w_acc = stage(:,:,2)
      end if
    end subroutine

    ! Classic RK4 on (x, v); w_acc holds a(x0, v0) on entry and a(x1, v1) on exit.
    subroutine rk4_step(h)
      real(c_double), intent(in) :: h
      ! stage: 1 x0, 2 v0, 3 k2x, 4 k2v, 5 k3x, 6 k3v, 7 k4x, 8 k4v
      stage(:,:,1) = w_pos
      stage(:,:,2) = w_vel
      stage(:,:,3) = w_vel + 0.5_c_double * h * w_acc
      call evaluate(stage(:,:,1) + 0.5_c_double * h * stage(:,:,2), stage(:,:,3), stage(:,:,4))
      if (status /= 0_c_int) return
      stage(:,:,5) = stage(:,:,2) + 0.5_c_double * h * stage(:,:,4)
      call evaluate(stage(:,:,1) + 0.5_c_double * h * stage(:,:,3), stage(:,:,5), stage(:,:,6))
      if (status /= 0_c_int) return
      stage(:,:,7) = stage(:,:,2) + h * stage(:,:,6)
      call evaluate(stage(:,:,1) + h * stage(:,:,5), stage(:,:,7), stage(:,:,8))
      if (status /= 0_c_int) return
      w_pos = stage(:,:,1) + h / 6.0_c_double * &
        (stage(:,:,2) + 2.0_c_double * stage(:,:,3) + 2.0_c_double * stage(:,:,5) + stage(:,:,7))
      w_vel = stage(:,:,2) + h / 6.0_c_double * &
        (w_acc + 2.0_c_double * stage(:,:,4) + 2.0_c_double * stage(:,:,6) + stage(:,:,8))
      if (.not. all_finite(n, w_pos) .or. .not. all_finite(n, w_vel)) then
        status = 3_c_int
        return
      end if
      call evaluate(w_pos, w_vel, w_acc)
    end subroutine

    ! Perfectly inelastic merge on contact (separation < sum of radii). The more
    ! massive body survives with the summed mass, the centre-of-mass position and
    ! velocity, and a volume-conserving radius. Test particles are absorbed.
    subroutine resolve_collisions(step_index, merged)
      integer, intent(in) :: step_index
      logical, intent(out) :: merged
      integer :: heavy(n), heavy_count, a, b, i, j, survivor, absorbed
      real(c_double) :: distance, total

      merged = .false.
      heavy_count = 0
      do i = 1, n
        if (w_active(i) == 0_c_int .or. w_mass(i) <= 0.0_c_double) cycle
        heavy_count = heavy_count + 1
        heavy(heavy_count) = i
      end do

      do a = 1, heavy_count - 1
        i = heavy(a)
        do b = a + 1, heavy_count
          if (w_active(i) == 0_c_int) exit
          j = heavy(b)
          if (w_active(j) == 0_c_int) cycle
          if (w_radius(i) + w_radius(j) <= 0.0_c_double) cycle
          distance = sqrt(sum((w_pos(:,j) - w_pos(:,i)) ** 2))
          if (distance >= w_radius(i) + w_radius(j)) cycle
          survivor = i
          absorbed = j
          if (w_mass(j) > w_mass(i)) then
            survivor = j
            absorbed = i
          end if
          total = w_mass(survivor) + w_mass(absorbed)
          w_pos(:,survivor) = (w_mass(survivor) * w_pos(:,survivor) + &
            w_mass(absorbed) * w_pos(:,absorbed)) / total
          w_vel(:,survivor) = (w_mass(survivor) * w_vel(:,survivor) + &
            w_mass(absorbed) * w_vel(:,absorbed)) / total
          w_radius(survivor) = (w_radius(survivor) ** 3 + w_radius(absorbed) ** 3) ** &
            (1.0_c_double / 3.0_c_double)
          w_mass(survivor) = total
          call deactivate(absorbed, survivor, step_index, distance)
          merged = .true.
        end do
      end do

      do j = 1, n
        if (w_active(j) == 0_c_int .or. w_mass(j) > 0.0_c_double) cycle
        do a = 1, heavy_count
          i = heavy(a)
          if (w_active(i) == 0_c_int) cycle
          if (w_radius(i) + w_radius(j) <= 0.0_c_double) cycle
          distance = sqrt(sum((w_pos(:,j) - w_pos(:,i)) ** 2))
          if (distance >= w_radius(i) + w_radius(j)) cycle
          call deactivate(j, i, step_index, distance)
          w_acc(:,j) = 0.0_c_double
          exit
        end do
      end do
    end subroutine

    subroutine deactivate(absorbed, survivor, step_index, distance)
      integer, intent(in) :: absorbed, survivor, step_index
      real(c_double), intent(in) :: distance
      w_active(absorbed) = 0_c_int
      w_pos(:,absorbed) = w_pos(:,survivor)
      w_vel(:,absorbed) = w_vel(:,survivor)
      collision_count = collision_count + 1_c_int
      call record(event_collision, step_index, absorbed, survivor, distance)
    end subroutine

    integer function reference_body()
      integer :: i
      reference_body = central_body(n, w_mass, w_active, options)
      if (reference_body > 0) return
      do i = 1, n
        if (w_active(i) == 0_c_int .or. w_mass(i) <= 0.0_c_double) cycle
        if (reference_body == 0) then
          reference_body = i
        else if (w_mass(i) > w_mass(reference_body)) then
          reference_body = i
        end if
      end do
    end function

    subroutine relative_state(j, radial, bound, eccentricity, distance)
      integer, intent(in) :: j
      real(c_double), intent(out) :: radial, eccentricity, distance
      logical, intent(out) :: bound
      real(c_double) :: r(3), v(3), mu, speed_squared
      r = w_pos(:,j) - w_pos(:,reference)
      v = w_vel(:,j) - w_vel(:,reference)
      distance = sqrt(sum(r * r))
      if (distance <= 0.0_c_double) then
        radial = 0.0_c_double
        bound = .true.
        eccentricity = 0.0_c_double
        return
      end if
      mu = grav * (w_mass(reference) + w_mass(j))
      speed_squared = sum(v * v)
      radial = direction * sum(r * v)
      ! Round-off at an exact turning point (e.g. a start at apoapsis) is not a crossing.
      if (abs(radial) <= radial_tolerance * distance * sqrt(speed_squared)) radial = 0.0_c_double
      bound = 0.5_c_double * speed_squared - mu / distance < 0.0_c_double
      eccentricity = sqrt(sum((((speed_squared - mu / distance) * r - sum(r * v) * v) / mu) ** 2))
    end subroutine

    subroutine reset_event_state()
      integer :: j
      real(c_double) :: eccentricity, distance
      previous_radial = 0.0_c_double
      previous_bound = .false.
      if (reference == 0) return
      do j = 1, n
        if (j == reference .or. w_active(j) == 0_c_int .or. w_mass(j) <= 0.0_c_double) cycle
        call relative_state(j, previous_radial(j), previous_bound(j), eccentricity, distance)
      end do
    end subroutine

    ! Turning points and escapes of massive bodies relative to the reference body
    ! (the central body, else the most massive). In reverse time the radial
    ! velocity sign is flipped so periapsis still means "closest approach".
    subroutine detect_events(step_index)
      integer, intent(in) :: step_index
      integer :: j, current
      real(c_double) :: radial, eccentricity, distance
      logical :: bound

      current = reference_body()
      if (current /= reference) then
        reference = current
        call reset_event_state()
        return
      end if
      if (reference == 0) return
      do j = 1, n
        if (j == reference .or. w_active(j) == 0_c_int .or. w_mass(j) <= 0.0_c_double) cycle
        call relative_state(j, radial, bound, eccentricity, distance)
        if (eccentricity >= event_min_eccentricity) then
          if (previous_radial(j) < 0.0_c_double .and. radial >= 0.0_c_double) &
            call record(event_periapsis, step_index, j, reference, distance)
          if (bound .and. previous_radial(j) > 0.0_c_double .and. radial <= 0.0_c_double) &
            call record(event_apoapsis, step_index, j, reference, distance)
        end if
        if (previous_bound(j) .and. .not. bound) &
          call record(event_escape, step_index, j, reference, distance)
        previous_radial(j) = radial
        previous_bound(j) = bound
      end do
    end subroutine

    subroutine record(kind, step_index, body, other, distance)
      integer(c_int), intent(in) :: kind
      integer, intent(in) :: step_index, body, other
      real(c_double), intent(in) :: distance
      if (event_count < event_capacity) then
        event_count = event_count + 1_c_int
        found(event_count)%kind = kind
        found(event_count)%step = int(step_index, c_int)
        found(event_count)%body = int(body - 1, c_int)
        found(event_count)%other = int(other - 1, c_int)
        found(event_count)%distance_m = distance
      else
        events_dropped = events_dropped + 1_c_int
      end if
    end subroutine
  end subroutine
end module
