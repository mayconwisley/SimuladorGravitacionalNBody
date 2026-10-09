module orbital_c_api
  use iso_c_binding, only: c_int, c_double
  use orbital_verlet, only: advance_orbits
  use orbital_diagnostics, only: calculate_diagnostics
  implicit none
  private
  public :: os_step, os_diagnostics

contains

  function os_step(n, mass, pos, vel, dt, grav, eps, steps) &
      bind(C, name="os_step") result(status)
    integer(c_int), value :: n, steps
    real(c_double), intent(in) :: mass(*)
    real(c_double), intent(inout) :: pos(3,*), vel(3,*)
    real(c_double), value :: dt, grav, eps
    integer(c_int) :: status

    status = 1_c_int
    if (n < 1 .or. steps < 1) return
    call advance_orbits(n, mass(1:n), pos(:,1:n), vel(:,1:n), dt, grav, eps, &
                        steps, status)
  end function

  function os_diagnostics(n, mass, pos, vel, grav, eps, energy, momentum, &
                          angular_momentum) bind(C, name="os_diagnostics") result(status)
    integer(c_int), value :: n
    real(c_double), intent(in) :: mass(*), pos(3,*), vel(3,*)
    real(c_double), value :: grav, eps
    real(c_double), intent(out) :: energy, momentum(3), angular_momentum(3)
    integer(c_int) :: status

    status = 1_c_int
    if (n < 1) return
    call calculate_diagnostics(n, mass(1:n), pos(:,1:n), vel(:,1:n), grav, eps, &
                               energy, momentum, angular_momentum, status)
  end function
end module
