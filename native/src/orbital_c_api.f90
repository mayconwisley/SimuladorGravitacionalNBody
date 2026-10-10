module orbital_c_api
  ! Stable C ABI. See native/include/orbitalsim.h for the contract and status codes.
  use iso_c_binding, only: c_int, c_double, c_ptr, c_associated, c_f_pointer
  use orbital_types, only: os_options, os_report, os_event, os_elements, default_options
  use orbital_integrator, only: advance_system
  use orbital_diagnostics, only: system_energy
  use orbital_elements, only: elements_batch, elements_to_state
  implicit none
  private
  public :: os_step, os_diagnostics, os_advance, os_energy
  public :: os_orbital_elements, os_elements_to_state

contains

  ! Legacy entry point: Velocity Verlet, positive masses and dt, no extra physics.
  function os_step(n, mass, pos, vel, dt, grav, eps, steps) &
      bind(C, name="os_step") result(status)
    integer(c_int), value :: n, steps
    real(c_double), intent(in) :: mass(*)
    real(c_double), intent(inout) :: pos(3,*), vel(3,*)
    real(c_double), value :: dt, grav, eps
    integer(c_int) :: status
    real(c_double), allocatable :: work_mass(:), radius(:), drag(:), acc(:,:)
    integer(c_int), allocatable :: active(:)
    type(os_report) :: report
    type(os_event) :: no_events(1)
    integer :: allocation_status

    status = 1_c_int
    if (n < 1 .or. steps < 1) return
    if (.not. (dt > 0.0_c_double) .or. .not. all(mass(1:n) > 0.0_c_double)) return
    allocate(work_mass(n), radius(n), drag(n), acc(3,n), active(n), stat=allocation_status)
    if (allocation_status /= 0) then
      status = 4_c_int
      return
    end if
    work_mass = mass(1:n)
    radius = 0.0_c_double
    drag = 0.0_c_double
    active = 1_c_int
    call advance_system(n, work_mass, radius, drag, active, pos(:,1:n), vel(:,1:n), acc, &
                        0_c_int, dt, grav, eps, steps, default_options(), report, &
                        no_events, 0_c_int, status)
  end function

  ! Legacy entry point: total energy (J), momentum and angular momentum of all bodies.
  function os_diagnostics(n, mass, pos, vel, grav, eps, energy, momentum, &
                          angular_momentum) bind(C, name="os_diagnostics") result(status)
    integer(c_int), value :: n
    real(c_double), intent(in) :: mass(*), pos(3,*), vel(3,*)
    real(c_double), value :: grav, eps
    real(c_double), intent(out) :: energy, momentum(3), angular_momentum(3)
    integer(c_int) :: status
    integer(c_int), allocatable :: active(:)
    real(c_double) :: kinetic, potential
    integer :: allocation_status

    status = 1_c_int
    energy = 0.0_c_double
    momentum = 0.0_c_double
    angular_momentum = 0.0_c_double
    if (n < 1) return
    if (.not. all(mass(1:n) > 0.0_c_double)) return
    allocate(active(n), stat=allocation_status)
    if (allocation_status /= 0) then
      status = 4_c_int
      return
    end if
    active = 1_c_int
    call system_energy(n, mass(1:n), active, pos(:,1:n), vel(:,1:n), grav, eps, &
                       default_options(), kinetic, potential, momentum, angular_momentum, status)
    energy = kinetic + potential
  end function

  function os_advance(n, mass, radius, drag, active, pos, vel, acc, acc_ready, dt, grav, eps, &
                      steps, options, report, events, event_capacity) &
      bind(C, name="os_advance") result(status)
    integer(c_int), value :: n, acc_ready, steps, event_capacity
    real(c_double), intent(inout) :: mass(*), radius(*), pos(3,*), vel(3,*), acc(3,*)
    real(c_double), intent(in) :: drag(*)
    integer(c_int), intent(inout) :: active(*)
    real(c_double), value :: dt, grav, eps
    type(os_options), intent(in) :: options
    type(os_report), intent(inout) :: report
    type(c_ptr), value :: events
    integer(c_int) :: status
    type(os_event), pointer :: event_buffer(:)
    type(os_event) :: no_events(1)

    status = 1_c_int
    if (n < 1 .or. steps < 1 .or. event_capacity < 0) return
    if (event_capacity > 0) then
      if (.not. c_associated(events)) return
      call c_f_pointer(events, event_buffer, [event_capacity])
      call advance_system(n, mass(1:n), radius(1:n), drag(1:n), active(1:n), pos(:,1:n), &
                          vel(:,1:n), acc(:,1:n), acc_ready, dt, grav, eps, steps, options, &
                          report, event_buffer, event_capacity, status)
    else
      call advance_system(n, mass(1:n), radius(1:n), drag(1:n), active(1:n), pos(:,1:n), &
                          vel(:,1:n), acc(:,1:n), acc_ready, dt, grav, eps, steps, options, &
                          report, no_events, 0_c_int, status)
    end if
  end function

  function os_energy(n, mass, active, pos, vel, grav, eps, options, kinetic, potential, &
                     momentum, angular_momentum) bind(C, name="os_energy") result(status)
    integer(c_int), value :: n
    real(c_double), intent(in) :: mass(*), pos(3,*), vel(3,*)
    integer(c_int), intent(in) :: active(*)
    real(c_double), value :: grav, eps
    type(os_options), intent(in) :: options
    real(c_double), intent(out) :: kinetic, potential, momentum(3), angular_momentum(3)
    integer(c_int) :: status

    status = 1_c_int
    kinetic = 0.0_c_double
    potential = 0.0_c_double
    momentum = 0.0_c_double
    angular_momentum = 0.0_c_double
    if (n < 1) return
    call system_energy(n, mass(1:n), active(1:n), pos(:,1:n), vel(:,1:n), grav, eps, &
                       options, kinetic, potential, momentum, angular_momentum, status)
  end function

  function os_orbital_elements(n, mass, active, pos, vel, grav, reference, elements, valid) &
      bind(C, name="os_orbital_elements") result(status)
    integer(c_int), value :: n, reference
    real(c_double), intent(in) :: mass(*), pos(3,*), vel(3,*)
    integer(c_int), intent(in) :: active(*)
    real(c_double), value :: grav
    type(os_elements), intent(out) :: elements(*)
    integer(c_int), intent(out) :: valid(*)
    integer(c_int) :: status

    status = 1_c_int
    if (n < 1 .or. reference < -1_c_int .or. reference >= n) return
    call elements_batch(n, mass(1:n), active(1:n), pos(:,1:n), vel(:,1:n), grav, &
                        reference + 1_c_int, elements(1:n), valid(1:n), status)
  end function

  function os_elements_to_state(grav, central_mass, body_mass, elements, pos, vel) &
      bind(C, name="os_elements_to_state") result(status)
    real(c_double), value :: grav, central_mass, body_mass
    type(os_elements), intent(in) :: elements
    real(c_double), intent(out) :: pos(3), vel(3)
    integer(c_int) :: status

    status = 1_c_int
    pos = 0.0_c_double
    vel = 0.0_c_double
    if (.not. (grav > 0.0_c_double) .or. .not. (central_mass > 0.0_c_double) .or. &
        .not. (body_mass >= 0.0_c_double)) return
    call elements_to_state(grav * (central_mass + body_mass), elements, pos, vel, status)
  end function
end module
