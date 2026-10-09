module orbital_diagnostics
  ! Conserved quantities of the active bodies in SI units. The potential uses the
  ! same softened separation sqrt(|r|^2 + eps^2) as orbital_forces and includes
  ! the J2 term of the central body, so it is conserved whenever drag and the 1PN
  ! correction are off. Test particles (zero mass) contribute nothing.
  use iso_c_binding, only: c_int, c_double
  use, intrinsic :: ieee_arithmetic, only: ieee_is_finite
  use orbital_types, only: os_options
  use orbital_forces, only: validate_options, central_body
  implicit none
  private
  public :: system_energy

contains

  subroutine system_energy(n, mass, active, pos, vel, grav, eps, options, kinetic, &
                           potential, momentum, angular_momentum, status)
    integer(c_int), intent(in) :: n, active(n)
    real(c_double), intent(in) :: mass(n), pos(3,n), vel(3,n), grav, eps
    type(os_options), intent(in) :: options
    real(c_double), intent(out) :: kinetic, potential, momentum(3), angular_momentum(3)
    integer(c_int), intent(out) :: status
    integer :: heavy(n), heavy_count, a, b, i, j, c
    real(c_double) :: delta(3), radius_squared, r(3), distance, mu

    status = 1_c_int
    kinetic = 0.0_c_double
    potential = 0.0_c_double
    momentum = 0.0_c_double
    angular_momentum = 0.0_c_double
    if (n < 1) return
    if (.not. ieee_is_finite(grav) .or. .not. ieee_is_finite(eps)) return
    if (grav <= 0.0_c_double .or. eps < 0.0_c_double) return
    if (.not. all(ieee_is_finite(mass)) .or. any(mass < 0.0_c_double)) return
    if (any(active /= 0_c_int .and. active /= 1_c_int)) return
    if (.not. all(ieee_is_finite(pos)) .or. .not. all(ieee_is_finite(vel))) return
    call validate_options(n, mass, options, status)
    if (status /= 0_c_int) return

    heavy_count = 0
    do i = 1, n
      if (active(i) == 0_c_int .or. mass(i) <= 0.0_c_double) cycle
      heavy_count = heavy_count + 1
      heavy(heavy_count) = i
      kinetic = kinetic + 0.5_c_double * mass(i) * sum(vel(:,i) * vel(:,i))
      momentum = momentum + mass(i) * vel(:,i)
      angular_momentum(1) = angular_momentum(1) + mass(i) * &
        (pos(2,i) * vel(3,i) - pos(3,i) * vel(2,i))
      angular_momentum(2) = angular_momentum(2) + mass(i) * &
        (pos(3,i) * vel(1,i) - pos(1,i) * vel(3,i))
      angular_momentum(3) = angular_momentum(3) + mass(i) * &
        (pos(1,i) * vel(2,i) - pos(2,i) * vel(1,i))
    end do

    do a = 1, heavy_count - 1
      i = heavy(a)
      do b = a + 1, heavy_count
        j = heavy(b)
        delta = pos(:,j) - pos(:,i)
        radius_squared = sum(delta * delta) + eps * eps
        if (radius_squared <= 0.0_c_double) then
          status = 2_c_int
          return
        end if
        potential = potential - grav * mass(i) * mass(j) / sqrt(radius_squared)
      end do
    end do

    c = central_body(n, mass, active, options)
    if (c > 0 .and. abs(options%j2) > 0.0_c_double) then
      mu = grav * mass(c)
      do a = 1, heavy_count
        j = heavy(a)
        if (j == c) cycle
        r = pos(:,j) - pos(:,c)
        distance = sqrt(sum(r * r))
        if (distance <= 0.0_c_double) cycle
        potential = potential + mass(j) * mu * options%j2 * options%central_radius_m ** 2 * &
          (3.0_c_double * (r(3) / distance) ** 2 - 1.0_c_double) / &
          (2.0_c_double * distance ** 3)
      end do
    end if

    status = 0_c_int
    if (.not. ieee_is_finite(kinetic) .or. .not. ieee_is_finite(potential) .or. &
        .not. all(ieee_is_finite(momentum)) .or. &
        .not. all(ieee_is_finite(angular_momentum))) status = 3_c_int
  end subroutine
end module
