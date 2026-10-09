module orbital_elements
  ! Conversions between relative state vectors (m, m/s) and osculating Keplerian
  ! elements for the gravitational parameter mu = G (M + m) in m^3/s^2.
  ! Rotation convention: r = Rz(node) Rx(inclination) Rz(argument) r_perifocal.
  ! Undefined angles are set to 0: the node for equatorial orbits and the argument
  ! of periapsis for circular ones; the true anomaly is then measured from the
  ! ascending node (or +x for equatorial orbits).
  use iso_c_binding, only: c_int, c_double
  use, intrinsic :: ieee_arithmetic, only: ieee_is_finite
  use orbital_types, only: os_elements
  implicit none
  private
  public :: state_to_elements, elements_to_state, elements_batch

  real(c_double), parameter :: pi = acos(-1.0_c_double)
  real(c_double), parameter :: angle_tolerance = 1.0e-11_c_double

contains

  pure function cross(u, v) result(w)
    real(c_double), intent(in) :: u(3), v(3)
    real(c_double) :: w(3)
    w = [u(2) * v(3) - u(3) * v(2), u(3) * v(1) - u(1) * v(3), u(1) * v(2) - u(2) * v(1)]
  end function

  pure real(c_double) function wrap(angle)
    real(c_double), intent(in) :: angle
    wrap = modulo(angle, 2.0_c_double * pi)
  end function

  ! Signed angle from `from` to `to`, measured counter-clockwise about `axis`.
  pure real(c_double) function signed_angle(from, to, axis)
    real(c_double), intent(in) :: from(3), to(3), axis(3)
    signed_angle = wrap(atan2(sum(cross(from, to) * axis) / sqrt(sum(axis * axis)), &
                              sum(from * to)))
  end function

  ! Status 1 for invalid input, 2 for a radial (zero angular momentum) trajectory.
  subroutine state_to_elements(mu, r, v, elements, status)
    real(c_double), intent(in) :: mu, r(3), v(3)
    type(os_elements), intent(out) :: elements
    integer(c_int), intent(out) :: status
    real(c_double) :: distance, speed_squared, h(3), h_norm, node(3), node_norm
    real(c_double) :: eccentricity_vector(3), eccentricity, energy, p, reference(3)

    elements = os_elements(0.0_c_double, 0.0_c_double, 0.0_c_double, 0.0_c_double, &
      0.0_c_double, 0.0_c_double, 0.0_c_double, 0.0_c_double, 0.0_c_double, 0.0_c_double)
    status = 1_c_int
    if (.not. ieee_is_finite(mu) .or. mu <= 0.0_c_double) return
    if (.not. all(ieee_is_finite(r)) .or. .not. all(ieee_is_finite(v))) return
    distance = sqrt(sum(r * r))
    if (distance <= 0.0_c_double) return

    speed_squared = sum(v * v)
    h = cross(r, v)
    h_norm = sqrt(sum(h * h))
    energy = 0.5_c_double * speed_squared - mu / distance
    elements%specific_energy_j_kg = energy
    if (h_norm <= angle_tolerance * distance * sqrt(speed_squared + mu / distance)) then
      status = 2_c_int
      return
    end if

    eccentricity_vector = ((speed_squared - mu / distance) * r - sum(r * v) * v) / mu
    eccentricity = sqrt(sum(eccentricity_vector * eccentricity_vector))
    p = h_norm * h_norm / mu
    elements%eccentricity = eccentricity
    if (abs(energy) > 0.0_c_double) elements%semi_major_axis_m = -mu / (2.0_c_double * energy)
    elements%inclination_rad = acos(max(-1.0_c_double, min(1.0_c_double, h(3) / h_norm)))

    node = [-h(2), h(1), 0.0_c_double]
    node_norm = sqrt(sum(node * node))
    if (node_norm > angle_tolerance * h_norm) then
      elements%ascending_node_rad = wrap(atan2(node(2), node(1)))
      reference = node
    else
      reference = [1.0_c_double, 0.0_c_double, 0.0_c_double]
    end if

    if (eccentricity > angle_tolerance) then
      elements%argument_periapsis_rad = signed_angle(reference, eccentricity_vector, h)
      elements%true_anomaly_rad = signed_angle(eccentricity_vector, r, h)
    else
      elements%true_anomaly_rad = signed_angle(reference, r, h)
    end if

    elements%periapsis_m = p / (1.0_c_double + eccentricity)
    if (eccentricity < 1.0_c_double .and. energy < 0.0_c_double) then
      elements%apoapsis_m = p / (1.0_c_double - eccentricity)
      elements%period_s = 2.0_c_double * pi * sqrt(elements%semi_major_axis_m ** 3 / mu)
    end if
    status = 0_c_int
  end subroutine

  ! Uses semi-major axis, eccentricity and the four angles; other fields are ignored.
  ! Ellipses need a > 0 and 0 <= e < 1, hyperbolas a < 0 and e > 1. Parabolas are
  ! rejected because a is undefined. Status 1 for invalid input.
  subroutine elements_to_state(mu, elements, r, v, status)
    real(c_double), intent(in) :: mu
    type(os_elements), intent(in) :: elements
    real(c_double), intent(out) :: r(3), v(3)
    integer(c_int), intent(out) :: status
    real(c_double) :: a, e, p, distance, cos_nu, sin_nu, speed_scale, q(3,2)
    real(c_double) :: cos_node, sin_node, cos_arg, sin_arg, cos_inc, sin_inc

    r = 0.0_c_double
    v = 0.0_c_double
    status = 1_c_int
    a = elements%semi_major_axis_m
    e = elements%eccentricity
    if (.not. ieee_is_finite(mu) .or. mu <= 0.0_c_double) return
    if (.not. ieee_is_finite(a) .or. .not. ieee_is_finite(e) .or. e < 0.0_c_double) return
    if (.not. ieee_is_finite(elements%inclination_rad) .or. &
        .not. ieee_is_finite(elements%ascending_node_rad) .or. &
        .not. ieee_is_finite(elements%argument_periapsis_rad) .or. &
        .not. ieee_is_finite(elements%true_anomaly_rad)) return
    if (e < 1.0_c_double) then
      if (a <= 0.0_c_double) return
    else if (e > 1.0_c_double) then
      if (a >= 0.0_c_double) return
    else
      return
    end if

    cos_nu = cos(elements%true_anomaly_rad)
    sin_nu = sin(elements%true_anomaly_rad)
    if (1.0_c_double + e * cos_nu <= 0.0_c_double) return
    p = a * (1.0_c_double - e * e)
    distance = p / (1.0_c_double + e * cos_nu)
    speed_scale = sqrt(mu / p)

    cos_node = cos(elements%ascending_node_rad)
    sin_node = sin(elements%ascending_node_rad)
    cos_arg = cos(elements%argument_periapsis_rad)
    sin_arg = sin(elements%argument_periapsis_rad)
    cos_inc = cos(elements%inclination_rad)
    sin_inc = sin(elements%inclination_rad)
    q(:,1) = [cos_node * cos_arg - sin_node * sin_arg * cos_inc, &
              sin_node * cos_arg + cos_node * sin_arg * cos_inc, &
              sin_arg * sin_inc]
    q(:,2) = [-cos_node * sin_arg - sin_node * cos_arg * cos_inc, &
              -sin_node * sin_arg + cos_node * cos_arg * cos_inc, &
              cos_arg * sin_inc]

    r = q(:,1) * distance * cos_nu + q(:,2) * distance * sin_nu
    v = q(:,1) * (-speed_scale * sin_nu) + q(:,2) * (speed_scale * (e + cos_nu))
    if (.not. all(ieee_is_finite(r)) .or. .not. all(ieee_is_finite(v))) return
    status = 0_c_int
  end subroutine

  ! Elements of every active body relative to `reference` (1-based; 0 selects the
  ! most massive active body). valid(j) = 1 when elements(j) is defined.
  subroutine elements_batch(n, mass, active, pos, vel, grav, reference, elements, valid, status)
    integer(c_int), intent(in) :: n, active(n), reference
    real(c_double), intent(in) :: mass(n), pos(3,n), vel(3,n), grav
    type(os_elements), intent(out) :: elements(n)
    integer(c_int), intent(out) :: valid(n)
    integer(c_int), intent(out) :: status
    integer :: j, ref
    integer(c_int) :: body_status

    valid = 0_c_int
    elements = os_elements(0.0_c_double, 0.0_c_double, 0.0_c_double, 0.0_c_double, &
      0.0_c_double, 0.0_c_double, 0.0_c_double, 0.0_c_double, 0.0_c_double, 0.0_c_double)
    status = 1_c_int
    if (n < 1 .or. reference < 0 .or. reference > n) return
    if (.not. ieee_is_finite(grav) .or. grav <= 0.0_c_double) return
    if (.not. all(ieee_is_finite(mass)) .or. any(mass < 0.0_c_double)) return
    if (.not. all(ieee_is_finite(pos)) .or. .not. all(ieee_is_finite(vel))) return

    ref = reference
    if (ref == 0) then
      do j = 1, n
        if (active(j) == 0_c_int) cycle
        if (ref == 0) then
          ref = j
        else if (mass(j) > mass(ref)) then
          ref = j
        end if
      end do
    end if
    status = 0_c_int
    if (ref == 0) return
    if (active(ref) == 0_c_int .or. mass(ref) <= 0.0_c_double) return

    do j = 1, n
      if (j == ref .or. active(j) == 0_c_int) cycle
      call state_to_elements(grav * (mass(ref) + mass(j)), pos(:,j) - pos(:,ref), &
                             vel(:,j) - vel(:,ref), elements(j), body_status)
      if (body_status == 0_c_int) valid(j) = 1_c_int
    end do
  end subroutine
end module
