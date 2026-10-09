module orbital_diagnostics
  use iso_c_binding, only: c_int, c_double
  use, intrinsic :: ieee_arithmetic, only: ieee_is_finite
  implicit none
  private
  public :: calculate_diagnostics

contains

  subroutine calculate_diagnostics(n, mass, pos, vel, grav, eps, energy, momentum, &
                                   angular_momentum, status)
    integer(c_int), intent(in) :: n
    real(c_double), intent(in) :: mass(n), pos(3,n), vel(3,n), grav, eps
    real(c_double), intent(out) :: energy, momentum(3), angular_momentum(3)
    integer(c_int), intent(out) :: status
    integer :: i, j
    real(c_double) :: delta(3), radius_squared

    status = 1_c_int
    energy = 0.0_c_double
    momentum = 0.0_c_double
    angular_momentum = 0.0_c_double
    if (n < 1) return
    if (.not. ieee_is_finite(grav) .or. .not. ieee_is_finite(eps)) return
    if (grav <= 0.0_c_double .or. eps < 0.0_c_double) return
    if (.not. all(ieee_is_finite(mass)) .or. any(mass <= 0.0_c_double)) return
    if (.not. all(ieee_is_finite(pos)) .or. .not. all(ieee_is_finite(vel))) return

    do i = 1, n
      energy = energy + 0.5_c_double * mass(i) * sum(vel(:,i) * vel(:,i))
      momentum = momentum + mass(i) * vel(:,i)
      angular_momentum(1) = angular_momentum(1) + mass(i) * &
        (pos(2,i) * vel(3,i) - pos(3,i) * vel(2,i))
      angular_momentum(2) = angular_momentum(2) + mass(i) * &
        (pos(3,i) * vel(1,i) - pos(1,i) * vel(3,i))
      angular_momentum(3) = angular_momentum(3) + mass(i) * &
        (pos(1,i) * vel(2,i) - pos(2,i) * vel(1,i))
      do j = i + 1, n
        delta = pos(:,j) - pos(:,i)
        radius_squared = sum(delta * delta) + eps * eps
        if (radius_squared <= 0.0_c_double) then
          status = 2_c_int
          return
        end if
        energy = energy - grav * mass(i) * mass(j) / sqrt(radius_squared)
      end do
    end do
    status = 0_c_int
    if (.not. ieee_is_finite(energy) .or. .not. all(ieee_is_finite(momentum)) .or. &
        .not. all(ieee_is_finite(angular_momentum))) status = 3_c_int
  end subroutine
end module
