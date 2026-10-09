module orbital_forces
  ! Accelerations in m/s^2. Bodies with zero mass are test particles: they feel
  ! gravity but exert none, so the cost is M^2 + M P instead of (M + P)^2.
  ! Pairwise gravity uses the Plummer softening |r|^2 + eps^2, the same
  ! convention as the softened potential in orbital_diagnostics.
  use iso_c_binding, only: c_int, c_double
  use, intrinsic :: ieee_arithmetic, only: ieee_is_finite
  use orbital_types, only: os_options, integrator_verlet, integrator_rk4
  implicit none
  private
  public :: validate_system, validate_options, total_accelerations
  public :: gravity_accelerations, uses_velocity, central_body, all_finite

contains

  ! Status 1 when any input is outside its documented domain.
  subroutine validate_system(n, mass, radius, drag, active, pos, vel, dt, grav, eps, &
                             steps, options, status)
    integer(c_int), intent(in) :: n, steps, active(n)
    real(c_double), intent(in) :: mass(n), radius(n), drag(n), pos(3,n), vel(3,n)
    real(c_double), intent(in) :: dt, grav, eps
    type(os_options), intent(in) :: options
    integer(c_int), intent(out) :: status

    status = 1_c_int
    if (n < 1 .or. steps < 1) return
    if (.not. ieee_is_finite(dt) .or. .not. abs(dt) > 0.0_c_double) return
    if (.not. ieee_is_finite(grav) .or. grav <= 0.0_c_double) return
    if (.not. ieee_is_finite(eps) .or. eps < 0.0_c_double) return
    if (.not. all(ieee_is_finite(mass)) .or. any(mass < 0.0_c_double)) return
    if (.not. all(ieee_is_finite(radius)) .or. any(radius < 0.0_c_double)) return
    if (.not. all(ieee_is_finite(drag)) .or. any(drag < 0.0_c_double)) return
    if (any(active /= 0_c_int .and. active /= 1_c_int)) return
    if (.not. all(ieee_is_finite(pos)) .or. .not. all(ieee_is_finite(vel))) return
    call validate_options(n, mass, options, status)
  end subroutine

  subroutine validate_options(n, mass, options, status)
    integer(c_int), intent(in) :: n
    real(c_double), intent(in) :: mass(n)
    type(os_options), intent(in) :: options
    integer(c_int), intent(out) :: status

    status = 1_c_int
    if (options%integrator < integrator_verlet .or. options%integrator > integrator_rk4) return
    if (options%collisions /= 0_c_int .and. options%collisions /= 1_c_int) return
    if (options%central_index < -1_c_int .or. options%central_index >= n) return
    if (.not. ieee_is_finite(options%j2) .or. &
        .not. ieee_is_finite(options%central_radius_m) .or. &
        .not. ieee_is_finite(options%atmosphere_density_kg_m3) .or. &
        .not. ieee_is_finite(options%atmosphere_scale_height_m) .or. &
        .not. ieee_is_finite(options%light_speed_m_s)) return
    if (options%central_radius_m < 0.0_c_double .or. &
        options%atmosphere_density_kg_m3 < 0.0_c_double .or. &
        options%atmosphere_scale_height_m < 0.0_c_double .or. &
        options%light_speed_m_s < 0.0_c_double) return
    if (options%central_index >= 0_c_int) then
      if (mass(options%central_index + 1) <= 0.0_c_double) return
    else if (abs(options%j2) > 0.0_c_double .or. &
             options%atmosphere_density_kg_m3 > 0.0_c_double .or. &
             options%light_speed_m_s > 0.0_c_double) then
      return
    end if
    if (abs(options%j2) > 0.0_c_double .and. options%central_radius_m <= 0.0_c_double) return
    if (options%atmosphere_density_kg_m3 > 0.0_c_double .and. &
        (options%atmosphere_scale_height_m <= 0.0_c_double .or. &
         options%central_radius_m <= 0.0_c_double)) return
    status = 0_c_int
  end subroutine

  pure logical function uses_velocity(options)
    type(os_options), intent(in) :: options
    uses_velocity = options%atmosphere_density_kg_m3 > 0.0_c_double .or. &
      options%light_speed_m_s > 0.0_c_double
  end function

  ! 1-based index of the active central body, or 0 when external forces are off.
  pure integer function central_body(n, mass, active, options)
    integer(c_int), intent(in) :: n, active(n)
    real(c_double), intent(in) :: mass(n)
    type(os_options), intent(in) :: options
    central_body = 0
    if (options%central_index < 0_c_int) return
    if (active(options%central_index + 1) == 0_c_int) return
    if (mass(options%central_index + 1) <= 0.0_c_double) return
    central_body = options%central_index + 1
  end function

  ! Newtonian pairwise gravity. min_r2 and min_tau2 track the smallest unsoftened
  ! squared separation and the smallest r^3 / (G (m_i + m_j)) seen so far over all pairs
  ! with a massive body; min_tau2_massive only over pairs of massive bodies.
  subroutine gravity_accelerations(n, mass, active, pos, grav, eps, acc, status, &
                                   min_r2, min_tau2, min_tau2_massive)
    integer(c_int), intent(in) :: n, active(n)
    real(c_double), intent(in) :: mass(n), pos(3,n), grav, eps
    real(c_double), intent(out) :: acc(3,n)
    integer(c_int), intent(out) :: status
    real(c_double), intent(inout) :: min_r2, min_tau2, min_tau2_massive
    integer :: heavy(n), light(n), heavy_count, light_count, a, b, i, j
    real(c_double) :: delta(3), radius_squared, softened_squared, inverse_radius_cubed
    real(c_double) :: heavy_x(n), heavy_y(n), heavy_z(n), heavy_gm(n), heavy_inverse_gm(n)
    real(c_double) :: x, y, z, dx, dy, dz, ax, ay, az, softened_cubed, factor, eps2
    real(c_double) :: local_r2, local_tau2

    status = 0_c_int
    acc = 0.0_c_double
    heavy_count = 0
    light_count = 0
    do i = 1, n
      if (active(i) == 0_c_int) cycle
      if (mass(i) > 0.0_c_double) then
        heavy_count = heavy_count + 1
        heavy(heavy_count) = i
      else
        light_count = light_count + 1
        light(light_count) = i
      end if
    end do

    do a = 1, heavy_count - 1
      i = heavy(a)
      do b = a + 1, heavy_count
        j = heavy(b)
        delta = pos(:,j) - pos(:,i)
        radius_squared = sum(delta * delta)
        softened_squared = radius_squared + eps * eps
        if (softened_squared <= 0.0_c_double) then
          status = 2_c_int
          return
        end if
        inverse_radius_cubed = 1.0_c_double / &
          (softened_squared * sqrt(softened_squared))
        acc(:,i) = acc(:,i) + grav * mass(j) * inverse_radius_cubed * delta
        acc(:,j) = acc(:,j) - grav * mass(i) * inverse_radius_cubed * delta
        min_r2 = min(min_r2, radius_squared)
        min_tau2_massive = min(min_tau2_massive, 1.0_c_double / &
          (inverse_radius_cubed * grav * (mass(i) + mass(j))))
        min_tau2 = min(min_tau2, min_tau2_massive)
      end do
    end do

    ! Test particles: hot loop over P x M pairs, written with scalars and contiguous
    ! copies of the massive bodies; no division per pair.
    if (light_count == 0) return
    do a = 1, heavy_count
      i = heavy(a)
      heavy_x(a) = pos(1,i)
      heavy_y(a) = pos(2,i)
      heavy_z(a) = pos(3,i)
      heavy_gm(a) = grav * mass(i)
      heavy_inverse_gm(a) = 1.0_c_double / heavy_gm(a)
    end do
    eps2 = eps * eps
    do b = 1, light_count
      j = light(b)
      x = pos(1,j)
      y = pos(2,j)
      z = pos(3,j)
      ax = 0.0_c_double
      ay = 0.0_c_double
      az = 0.0_c_double
      local_r2 = huge(1.0_c_double)
      local_tau2 = huge(1.0_c_double)
      do a = 1, heavy_count
        dx = heavy_x(a) - x
        dy = heavy_y(a) - y
        dz = heavy_z(a) - z
        radius_squared = dx * dx + dy * dy + dz * dz
        softened_squared = radius_squared + eps2
        softened_cubed = softened_squared * sqrt(softened_squared)
        factor = heavy_gm(a) / softened_cubed
        ax = ax + factor * dx
        ay = ay + factor * dy
        az = az + factor * dz
        local_r2 = min(local_r2, radius_squared)
        local_tau2 = min(local_tau2, softened_cubed * heavy_inverse_gm(a))
      end do
      if (.not. local_tau2 > 0.0_c_double) then
        status = 2_c_int
        return
      end if
      acc(1,j) = ax
      acc(2,j) = ay
      acc(3,j) = az
      min_r2 = min(min_r2, local_r2)
      min_tau2 = min(min_tau2, local_tau2)
    end do
  end subroutine

  ! NaN and infinity propagate through a sum, so one reduction checks the whole array.
  ! (A sum that overflows from finite values is far beyond any physical scale.)
  pure logical function all_finite(n, values)
    integer(c_int), intent(in) :: n
    real(c_double), intent(in) :: values(3,n)
    all_finite = ieee_is_finite(sum(values))
  end function

  ! Adds the central body's J2, exponential-atmosphere drag and 1PN accelerations
  ! on every other active body, with the reaction on the central body so total
  ! linear momentum is conserved. Drag uses drag(j) = Cd A / m in m^2/kg.
  subroutine external_accelerations(n, mass, drag, active, pos, vel, grav, options, acc)
    integer(c_int), intent(in) :: n, active(n)
    real(c_double), intent(in) :: mass(n), drag(n), pos(3,n), vel(3,n), grav
    type(os_options), intent(in) :: options
    real(c_double), intent(inout) :: acc(3,n)
    integer :: c, j
    real(c_double) :: mu, r(3), v(3), distance, extra(3), z_ratio_squared, factor
    real(c_double) :: density, speed, light_squared, speed_squared, radial_speed

    c = central_body(n, mass, active, options)
    if (c == 0) return
    mu = grav * mass(c)
    light_squared = options%light_speed_m_s ** 2
    do j = 1, n
      if (j == c .or. active(j) == 0_c_int) cycle
      r = pos(:,j) - pos(:,c)
      v = vel(:,j) - vel(:,c)
      distance = sqrt(sum(r * r))
      if (distance <= 0.0_c_double) cycle
      extra = 0.0_c_double

      if (abs(options%j2) > 0.0_c_double) then
        z_ratio_squared = (r(3) / distance) ** 2
        factor = -1.5_c_double * options%j2 * mu * options%central_radius_m ** 2 / &
          distance ** 5
        extra(1) = extra(1) + factor * r(1) * (1.0_c_double - 5.0_c_double * z_ratio_squared)
        extra(2) = extra(2) + factor * r(2) * (1.0_c_double - 5.0_c_double * z_ratio_squared)
        extra(3) = extra(3) + factor * r(3) * (3.0_c_double - 5.0_c_double * z_ratio_squared)
      end if

      if (options%atmosphere_density_kg_m3 > 0.0_c_double .and. drag(j) > 0.0_c_double) then
        density = options%atmosphere_density_kg_m3 * exp(-max(0.0_c_double, &
          distance - options%central_radius_m) / options%atmosphere_scale_height_m)
        speed = sqrt(sum(v * v))
        extra = extra - 0.5_c_double * density * drag(j) * speed * v
      end if

      if (light_squared > 0.0_c_double) then
        speed_squared = sum(v * v)
        radial_speed = sum(r * v)
        extra = extra + mu / (light_squared * distance ** 3) * &
          ((4.0_c_double * mu / distance - speed_squared) * r + &
           4.0_c_double * radial_speed * v)
      end if

      acc(:,j) = acc(:,j) + extra
      acc(:,c) = acc(:,c) - (mass(j) / mass(c)) * extra
    end do
  end subroutine

  subroutine total_accelerations(n, mass, drag, active, pos, vel, grav, eps, options, &
                                 acc, status, min_r2, min_tau2, min_tau2_massive)
    integer(c_int), intent(in) :: n, active(n)
    real(c_double), intent(in) :: mass(n), drag(n), pos(3,n), vel(3,n), grav, eps
    type(os_options), intent(in) :: options
    real(c_double), intent(out) :: acc(3,n)
    integer(c_int), intent(out) :: status
    real(c_double), intent(inout) :: min_r2, min_tau2, min_tau2_massive

    call gravity_accelerations(n, mass, active, pos, grav, eps, acc, status, min_r2, min_tau2, &
                               min_tau2_massive)
    if (status /= 0_c_int) return
    call external_accelerations(n, mass, drag, active, pos, vel, grav, options, acc)
    if (.not. all_finite(n, acc)) status = 3_c_int
  end subroutine
end module
