module orbital_forces
  use iso_c_binding, only: c_int, c_double
  use, intrinsic :: ieee_arithmetic, only: ieee_is_finite
  implicit none
  private
  public :: calculate_accelerations, validate_input

contains

  subroutine validate_input(n, mass, pos, vel, dt, grav, eps, steps, status)
    integer(c_int), intent(in) :: n, steps
    real(c_double), intent(in) :: mass(n), pos(3,n), vel(3,n), dt, grav, eps
    integer(c_int), intent(out) :: status

    status = 1_c_int
    if (n < 1 .or. steps < 1) return
    if (.not. ieee_is_finite(dt) .or. .not. ieee_is_finite(grav) .or. &
        .not. ieee_is_finite(eps)) return
    if (dt <= 0.0_c_double .or. grav <= 0.0_c_double .or. eps < 0.0_c_double) return
    if (.not. all(ieee_is_finite(mass)) .or. any(mass <= 0.0_c_double)) return
    if (.not. all(ieee_is_finite(pos)) .or. .not. all(ieee_is_finite(vel))) return
    status = 0_c_int
  end subroutine

  subroutine calculate_accelerations(n, mass, pos, grav, eps, acc, status)
    integer(c_int), intent(in) :: n
    real(c_double), intent(in) :: mass(n), pos(3,n), grav, eps
    real(c_double), intent(out) :: acc(3,n)
    integer(c_int), intent(out) :: status
    integer :: i, j
    real(c_double) :: delta(3), radius_squared, inverse_radius_cubed

    status = 0_c_int
    acc = 0.0_c_double
    do i = 1, n - 1
      do j = i + 1, n
        delta = pos(:,j) - pos(:,i)
        radius_squared = sum(delta * delta) + eps * eps
        if (radius_squared <= 0.0_c_double) then
          status = 2_c_int
          return
        end if
        inverse_radius_cubed = 1.0_c_double / &
          (radius_squared * sqrt(radius_squared))
        acc(:,i) = acc(:,i) + grav * mass(j) * inverse_radius_cubed * delta
        acc(:,j) = acc(:,j) - grav * mass(i) * inverse_radius_cubed * delta
      end do
    end do
    if (.not. all(ieee_is_finite(acc))) status = 3_c_int
  end subroutine
end module
