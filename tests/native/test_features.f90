module test_features
  ! Deterministic tests for os_advance, os_energy and the orbital-element ABI.
  ! Units are G = 1 unless a test states otherwise; tolerances come from the
  ! analytical order of each method or theory and are stated next to each check.
  use iso_c_binding, only: c_int, c_double, c_loc, c_null_ptr
  use orbital_types
  use orbital_c_api
  implicit none
  private
  public :: run_feature_tests

  real(c_double), parameter :: pi = acos(-1.0_c_double)

contains

  subroutine run_feature_tests()
    call test_energy_split()
    call test_convergence_orders()
    call test_energy_behaviour()
    call test_acceleration_cache()
    call test_test_particles()
    call test_element_round_trips()
    call test_j2_precession()
    call test_drag_decay()
    call test_1pn_precession()
    call test_1pn_equal_masses()
    call test_collisions()
    call test_turning_point_events()
    call test_escape_events()
    call test_time_reversal()
    call test_report()
    call test_validation_and_preservation()
  end subroutine

  subroutine check(condition, label)
    logical, intent(in) :: condition
    character(*), intent(in) :: label
    if (.not. condition) then
      print *, 'FAILED: ', label
      error stop 1
    end if
  end subroutine

  ! Exact equality of finite values, written without == to keep -Wcompare-reals quiet.
  elemental logical function same(a, b)
    real(c_double), intent(in) :: a, b
    same = abs(a - b) <= 0.0_c_double
  end function

  pure real(c_double) function angle_difference(a, b)
    real(c_double), intent(in) :: a, b
    angle_difference = modulo(a - b + pi, 2.0_c_double * pi) - pi
  end function

  ! Equal-mass circular binary: m = 1, separation 1, period 2 pi / sqrt(2).
  subroutine circular_binary(mass, pos, vel)
    real(c_double), intent(out) :: mass(2), pos(3,2), vel(3,2)
    mass = 1.0_c_double
    pos = 0.0_c_double
    vel = 0.0_c_double
    pos(1,1) = -0.5_c_double
    pos(1,2) = 0.5_c_double
    vel(2,1) = -sqrt(0.5_c_double)
    vel(2,2) = sqrt(0.5_c_double)
  end subroutine

  ! Central body (index 1, at rest) and one body on the given relative orbit.
  subroutine central_orbit(central_mass, body_mass, elements, mass, pos, vel)
    real(c_double), intent(in) :: central_mass, body_mass
    type(os_elements), intent(in) :: elements
    real(c_double), intent(out) :: mass(2), pos(3,2), vel(3,2)
    integer(c_int) :: status
    mass = [central_mass, body_mass]
    pos = 0.0_c_double
    vel = 0.0_c_double
    status = os_elements_to_state(1.0_c_double, central_mass, body_mass, elements, &
                                  pos(:,2), vel(:,2))
    call check(status == 0_c_int, 'orbit set-up from elements')
  end subroutine

  function kepler(a, e, inclination, node, argument, anomaly) result(elements)
    real(c_double), intent(in) :: a, e, inclination, node, argument, anomaly
    type(os_elements) :: elements
    elements = os_elements(a, e, inclination, node, argument, anomaly, 0.0_c_double, &
      0.0_c_double, 0.0_c_double, 0.0_c_double)
  end function

  integer(c_int) function advance(n, mass, pos, vel, dt, steps, options, report)
    integer, intent(in) :: n, steps
    real(c_double), intent(inout) :: mass(n), pos(3,n), vel(3,n)
    real(c_double), intent(in) :: dt
    type(os_options), intent(in) :: options
    type(os_report), intent(out) :: report
    real(c_double) :: radius(n), drag(n), acc(3,n)
    integer(c_int) :: active(n)
    radius = 0.0_c_double
    drag = 0.0_c_double
    active = 1_c_int
    acc = 0.0_c_double
    advance = os_advance(int(n, c_int), mass, radius, drag, active, pos, vel, acc, 0_c_int, &
                         dt, 1.0_c_double, 0.0_c_double, int(steps, c_int), options, report, &
                         c_null_ptr, 0_c_int)
  end function

  real(c_double) function total_energy(n, mass, pos, vel, options)
    integer, intent(in) :: n
    real(c_double), intent(in) :: mass(n), pos(3,n), vel(3,n)
    type(os_options), intent(in) :: options
    integer(c_int) :: active(n), status
    real(c_double) :: kinetic, potential, momentum(3), angular(3)
    active = 1_c_int
    status = os_energy(int(n, c_int), mass, active, pos, vel, 1.0_c_double, 0.0_c_double, &
                       options, kinetic, potential, momentum, angular)
    call check(status == 0_c_int, 'energy evaluation')
    total_energy = kinetic + potential
  end function

  type(os_elements) function elements_of_second(mass, pos, vel)
    real(c_double), intent(in) :: mass(2), pos(3,2), vel(3,2)
    type(os_elements) :: elements(2)
    integer(c_int) :: valid(2), active(2), status
    active = 1_c_int
    status = os_orbital_elements(2_c_int, mass, active, pos, vel, 1.0_c_double, 0_c_int, &
                                 elements, valid)
    call check(status == 0_c_int .and. valid(2) == 1_c_int, 'elements of second body')
    elements_of_second = elements(2)
  end function

  ! Circular binary: K = 2 * 0.5 * 1 * 0.5 = 0.5 J, U = -G m m / r = -1 J (tol 1e-14).
  subroutine test_energy_split()
    real(c_double) :: mass(2), pos(3,2), vel(3,2), kinetic, potential, momentum(3), angular(3)
    integer(c_int) :: active(2), status
    call circular_binary(mass, pos, vel)
    active = 1_c_int
    status = os_energy(2_c_int, mass, active, pos, vel, 1.0_c_double, 0.0_c_double, &
                       default_options(), kinetic, potential, momentum, angular)
    call check(status == 0_c_int, 'energy split status')
    call check(abs(kinetic - 0.5_c_double) < 1.0e-14_c_double, 'kinetic energy')
    call check(abs(potential + 1.0_c_double) < 1.0e-14_c_double, 'potential energy')
    call check(abs(angular(3) - sqrt(0.5_c_double)) < 1.0e-14_c_double, 'angular momentum')
  end subroutine

  ! Closure error of one circular binary orbit with 100 and 200 steps.
  ! Expected ratios: 4 for 2nd order (Verlet), 16 for 4th order (Yoshida, RK4).
  subroutine test_convergence_orders()
    real(c_double) :: ratio
    ratio = closure_error(integrator_verlet, 100) / closure_error(integrator_verlet, 200)
    call check(ratio > 3.5_c_double .and. ratio < 4.5_c_double, 'Verlet second-order convergence')
    ratio = closure_error(integrator_yoshida4, 100) / closure_error(integrator_yoshida4, 200)
    call check(ratio > 14.0_c_double .and. ratio < 18.0_c_double, 'Yoshida fourth-order convergence')
    ratio = closure_error(integrator_rk4, 100) / closure_error(integrator_rk4, 200)
    call check(ratio > 14.0_c_double .and. ratio < 22.0_c_double, 'RK4 fourth-order convergence')
  end subroutine

  real(c_double) function closure_error(integrator, steps)
    integer(c_int), intent(in) :: integrator
    integer, intent(in) :: steps
    real(c_double) :: mass(2), pos(3,2), vel(3,2), initial(3,2)
    type(os_options) :: options
    type(os_report) :: report
    options = default_options()
    options%integrator = integrator
    call circular_binary(mass, pos, vel)
    initial = pos
    call check(advance(2, mass, pos, vel, 2.0_c_double * pi / sqrt(2.0_c_double) / steps, &
                       steps, options, report) == 0_c_int, 'convergence orbit')
    closure_error = maxval(abs(pos - initial))
  end function

  ! Equal-mass binary, relative e = 0.6, 200 steps per orbit, 200 orbits, energy
  ! sampled every 5 steps. Symplectic methods keep the error bounded (late/early
  ! maximum < 1.5); RK4 drifts secularly (10x longer time gives > 5x the error).
  subroutine test_energy_behaviour()
    call check(drift_growth(integrator_verlet) < 1.5_c_double, 'Verlet energy error bounded')
    call check(drift_growth(integrator_yoshida4) < 1.5_c_double, 'Yoshida energy error bounded')
    call check(drift_growth(integrator_rk4) > 5.0_c_double, 'RK4 energy drift is secular')
  end subroutine

  real(c_double) function drift_growth(integrator)
    integer(c_int), intent(in) :: integrator
    real(c_double) :: mass(2), radius(2), drag(2), pos(3,2), vel(3,2), acc(3,2), rel(3), relv(3)
    real(c_double) :: period, initial, error, early, late
    integer(c_int) :: active(2), status, chunk
    type(os_options) :: options
    type(os_report) :: report
    options = default_options()
    options%integrator = integrator
    mass = 1.0_c_double
    radius = 0.0_c_double
    drag = 0.0_c_double
    active = 1_c_int
    status = os_elements_to_state(1.0_c_double, 1.0_c_double, 1.0_c_double, &
      kepler(1.0_c_double, 0.6_c_double, 0.0_c_double, 0.0_c_double, 0.0_c_double, pi), rel, relv)
    pos(:,1) = -0.5_c_double * rel
    pos(:,2) = 0.5_c_double * rel
    vel(:,1) = -0.5_c_double * relv
    vel(:,2) = 0.5_c_double * relv
    period = 2.0_c_double * pi / sqrt(2.0_c_double)
    initial = total_energy(2, mass, pos, vel, options)
    early = 0.0_c_double
    late = 0.0_c_double
    do chunk = 1, 8000
      status = os_advance(2_c_int, mass, radius, drag, active, pos, vel, acc, &
                          merge(1_c_int, 0_c_int, chunk > 1), period / 200.0_c_double, &
                          1.0_c_double, 0.0_c_double, 5_c_int, options, report, c_null_ptr, 0_c_int)
      call check(status == 0_c_int, 'energy behaviour step')
      error = abs((total_energy(2, mass, pos, vel, options) - initial) / initial)
      if (chunk <= 800) early = max(early, error)
      if (chunk > 7200) late = max(late, error)
    end do
    drift_growth = late / early
  end function

  ! 1000 steps in one call equal two calls of 500 steps reusing the acceleration
  ! buffer, bit for bit, for Verlet and Yoshida.
  subroutine test_acceleration_cache()
    integer(c_int) :: integrator
    real(c_double) :: mass(2), radius(2), drag(2), pos(3,2), vel(3,2), acc(3,2)
    real(c_double) :: one_pos(3,2), one_vel(3,2), dt
    integer(c_int) :: active(2), status
    type(os_options) :: options
    type(os_report) :: report
    radius = 0.0_c_double
    drag = 0.0_c_double
    active = 1_c_int
    dt = 1.0e-3_c_double
    do integrator = integrator_verlet, integrator_yoshida4
      options = default_options()
      options%integrator = integrator
      call circular_binary(mass, pos, vel)
      status = os_advance(2_c_int, mass, radius, drag, active, pos, vel, acc, 0_c_int, dt, &
                          1.0_c_double, 0.0_c_double, 1000_c_int, options, report, c_null_ptr, 0_c_int)
      one_pos = pos
      one_vel = vel
      call circular_binary(mass, pos, vel)
      status = os_advance(2_c_int, mass, radius, drag, active, pos, vel, acc, 0_c_int, dt, &
                          1.0_c_double, 0.0_c_double, 500_c_int, options, report, c_null_ptr, 0_c_int)
      status = os_advance(2_c_int, mass, radius, drag, active, pos, vel, acc, 1_c_int, dt, &
                          1.0_c_double, 0.0_c_double, 500_c_int, options, report, c_null_ptr, 0_c_int)
      call check(status == 0_c_int .and. all(same(pos, one_pos)) .and. all(same(vel, one_vel)), &
                 'acceleration cache reproduces a single call')
    end do
  end subroutine

  ! A massless particle on a circular orbit around M = 1 at r = 1 (period 2 pi,
  ! Yoshida, 2000 steps) closes within 1e-9 and leaves M exactly at rest; adding
  ! it to a binary leaves the binary's trajectory bit for bit unchanged.
  subroutine test_test_particles()
    real(c_double) :: mass(2), pos(3,2), vel(3,2), initial(3)
    real(c_double) :: mass3(3), pos3(3,3), vel3(3,3), binary_mass(2), binary_pos(3,2), binary_vel(3,2)
    type(os_options) :: options
    type(os_report) :: report
    options = default_options()
    options%integrator = integrator_yoshida4
    mass = [1.0_c_double, 0.0_c_double]
    pos = 0.0_c_double
    vel = 0.0_c_double
    pos(1,2) = 1.0_c_double
    vel(2,2) = 1.0_c_double
    initial = pos(:,2)
    call check(advance(2, mass, pos, vel, 2.0_c_double * pi / 2000.0_c_double, 2000, options, &
                       report) == 0_c_int, 'test particle orbit')
    call check(maxval(abs(pos(:,2) - initial)) < 1.0e-9_c_double, 'test particle orbit closure')
    call check(all(same(pos(:,1), 0.0_c_double)) .and. all(same(vel(:,1), 0.0_c_double)), &
               'test particle exerts no force')

    call circular_binary(binary_mass, binary_pos, binary_vel)
    mass3 = [binary_mass, 0.0_c_double]
    pos3(:,1:2) = binary_pos
    vel3(:,1:2) = binary_vel
    pos3(:,3) = [3.0_c_double, 0.0_c_double, 0.0_c_double]
    vel3(:,3) = [0.0_c_double, 0.5_c_double, 0.0_c_double]
    call check(advance(2, binary_mass, binary_pos, binary_vel, 1.0e-3_c_double, 3000, options, &
                       report) == 0_c_int, 'binary alone')
    call check(advance(3, mass3, pos3, vel3, 1.0e-3_c_double, 3000, options, report) == 0_c_int, &
               'binary with particle')
    call check(all(same(pos3(:,1:2), binary_pos)) .and. all(same(vel3(:,1:2), binary_vel)), &
               'binary unchanged by a test particle')
  end subroutine

  ! Elements -> state -> elements for an ellipse and a retrograde hyperbola
  ! (tol 1e-11), state -> elements -> state for degenerate circular/equatorial
  ! orbits (tol 1e-12), invalid inputs, and the batch call on the circular binary.
  subroutine test_element_round_trips()
    call check_round_trip(kepler(2.0_c_double, 0.3_c_double, 0.7_c_double, 1.1_c_double, &
      2.2_c_double, 0.4_c_double), 'ellipse round trip')
    call check_round_trip(kepler(-2.0_c_double, 1.4_c_double, 2.5_c_double, 4.0_c_double, &
      5.0_c_double, 0.3_c_double), 'hyperbola round trip')
    call check_state_round_trip(kepler(1.0_c_double, 0.0_c_double, 0.0_c_double, 0.0_c_double, &
      0.0_c_double, 1.0_c_double), 'circular equatorial round trip')
    call check_state_round_trip(kepler(1.0_c_double, 0.2_c_double, pi, 0.0_c_double, &
      0.8_c_double, 1.0_c_double), 'retrograde equatorial round trip')
    call check_state_round_trip(kepler(1.5_c_double, 0.0_c_double, 0.9_c_double, 2.0_c_double, &
      0.0_c_double, 2.5_c_double), 'circular inclined round trip')
    call check_invalid(kepler(1.0_c_double, 1.0_c_double, 0.0_c_double, 0.0_c_double, &
      0.0_c_double, 0.0_c_double), 'parabola rejected')
    call check_invalid(kepler(-1.0_c_double, 0.5_c_double, 0.0_c_double, 0.0_c_double, &
      0.0_c_double, 0.0_c_double), 'negative a for ellipse rejected')
    call check_invalid(kepler(-1.0_c_double, 2.0_c_double, 0.0_c_double, 0.0_c_double, &
      0.0_c_double, pi), 'hyperbola beyond asymptote rejected')
    call check_binary_elements()
  end subroutine

  subroutine check_round_trip(elements, label)
    type(os_elements), intent(in) :: elements
    character(*), intent(in) :: label
    real(c_double) :: mass(2), pos(3,2), vel(3,2)
    type(os_elements) :: back
    call central_orbit(1.0_c_double, 0.0_c_double, elements, mass, pos, vel)
    back = elements_of_second(mass, pos, vel)
    call check(abs(back%semi_major_axis_m - elements%semi_major_axis_m) < 1.0e-11_c_double .and. &
      abs(back%eccentricity - elements%eccentricity) < 1.0e-11_c_double .and. &
      abs(angle_difference(back%inclination_rad, elements%inclination_rad)) < 1.0e-11_c_double .and. &
      abs(angle_difference(back%ascending_node_rad, elements%ascending_node_rad)) < 1.0e-11_c_double .and. &
      abs(angle_difference(back%argument_periapsis_rad, elements%argument_periapsis_rad)) < 1.0e-11_c_double .and. &
      abs(angle_difference(back%true_anomaly_rad, elements%true_anomaly_rad)) < 1.0e-11_c_double, label)
  end subroutine

  subroutine check_state_round_trip(elements, label)
    type(os_elements), intent(in) :: elements
    character(*), intent(in) :: label
    real(c_double) :: mass(2), pos(3,2), vel(3,2), again(3), again_vel(3)
    type(os_elements) :: back
    integer(c_int) :: status
    call central_orbit(1.0_c_double, 0.0_c_double, elements, mass, pos, vel)
    back = elements_of_second(mass, pos, vel)
    status = os_elements_to_state(1.0_c_double, 1.0_c_double, 0.0_c_double, back, again, again_vel)
    call check(status == 0_c_int .and. maxval(abs(again - pos(:,2))) < 1.0e-12_c_double .and. &
               maxval(abs(again_vel - vel(:,2))) < 1.0e-12_c_double, label)
  end subroutine

  subroutine check_invalid(elements, label)
    type(os_elements), intent(in) :: elements
    character(*), intent(in) :: label
    real(c_double) :: pos(3), vel(3)
    call check(os_elements_to_state(1.0_c_double, 1.0_c_double, 0.0_c_double, elements, pos, vel) &
               == 1_c_int, label)
  end subroutine

  ! Relative orbit of the circular binary: a = 1, e = 0, period 2 pi / sqrt(2).
  subroutine check_binary_elements()
    real(c_double) :: mass(2), pos(3,2), vel(3,2)
    type(os_elements) :: elements(2)
    integer(c_int) :: valid(2), active(2), status
    call circular_binary(mass, pos, vel)
    active = 1_c_int
    status = os_orbital_elements(2_c_int, mass, active, pos, vel, 1.0_c_double, -1_c_int, &
                                 elements, valid)
    call check(status == 0_c_int .and. valid(1) == 0_c_int .and. valid(2) == 1_c_int, &
               'batch elements validity')
    call check(abs(elements(2)%semi_major_axis_m - 1.0_c_double) < 1.0e-12_c_double .and. &
               elements(2)%eccentricity < 1.0e-12_c_double .and. &
               abs(elements(2)%period_s - 2.0_c_double * pi / sqrt(2.0_c_double)) < 1.0e-12_c_double, &
               'batch elements of the circular binary')
  end subroutine

  ! M = 1, R = 0.5, J2 = 0.002, m = 1e-3 on a = 1, e = 0.05, i = 45 deg; Yoshida,
  ! 1000 steps per orbit, 20 orbits. The node regresses at
  ! -3/2 n J2 (R/p)^2 cos i (first order; measured error 0.1%, tol 1%), and the
  ! energy including the J2 potential is conserved (tol 1e-9 relative).
  subroutine test_j2_precession()
    real(c_double) :: mass(2), pos(3,2), vel(3,2), period, initial_energy, predicted, measured
    type(os_options) :: options
    type(os_report) :: report
    type(os_elements) :: before, after
    options = default_options()
    options%integrator = integrator_yoshida4
    options%central_index = 0_c_int
    options%j2 = 0.002_c_double
    options%central_radius_m = 0.5_c_double
    call central_orbit(1.0_c_double, 1.0e-3_c_double, &
      kepler(1.0_c_double, 0.05_c_double, pi / 4.0_c_double, 0.3_c_double, 0.2_c_double, &
             0.0_c_double), mass, pos, vel)
    period = 2.0_c_double * pi / sqrt(1.001_c_double)
    before = elements_of_second(mass, pos, vel)
    initial_energy = total_energy(2, mass, pos, vel, options)
    call check(advance(2, mass, pos, vel, period / 1000.0_c_double, 20000, options, report) &
               == 0_c_int, 'J2 integration')
    after = elements_of_second(mass, pos, vel)
    measured = angle_difference(after%ascending_node_rad, before%ascending_node_rad)
    predicted = -1.5_c_double * sqrt(1.001_c_double) * options%j2 * &
      (0.5_c_double / (1.0_c_double - 0.05_c_double ** 2)) ** 2 * cos(pi / 4.0_c_double) * 20.0_c_double * period
    call check(abs(measured / predicted - 1.0_c_double) < 0.01_c_double, 'J2 nodal regression rate')
    call check(abs((total_energy(2, mass, pos, vel, options) - initial_energy) / initial_energy) &
               < 1.0e-9_c_double, 'J2 energy conservation')
  end subroutine

  ! Circular orbit at r = 1.1 around M = 1 (R = 1) in an atmosphere rho0 = 1e-3,
  ! H = 0.1 with Cd A / m = 1; Yoshida, 1000 steps, one orbit. First-order decay
  ! da = -rho B sqrt(mu a) T (measured error 1.4%, tol 5%); total momentum stays
  ! conserved because the reaction acts on the central body (tol 1e-12 m v).
  subroutine test_drag_decay()
    real(c_double) :: mass(2), radius(2), drag(2), pos(3,2), vel(3,2), acc(3,2), period
    real(c_double) :: momentum_before(3), momentum_after(3), expected, decay
    integer(c_int) :: active(2), status
    type(os_options) :: options
    type(os_report) :: report
    type(os_elements) :: before, after
    options = default_options()
    options%integrator = integrator_yoshida4
    options%central_index = 0_c_int
    options%central_radius_m = 1.0_c_double
    options%atmosphere_density_kg_m3 = 1.0e-3_c_double
    options%atmosphere_scale_height_m = 0.1_c_double
    call central_orbit(1.0_c_double, 1.0e-6_c_double, kepler(1.1_c_double, 0.0_c_double, &
      0.0_c_double, 0.0_c_double, 0.0_c_double, 0.0_c_double), mass, pos, vel)
    radius = 0.0_c_double
    drag = [0.0_c_double, 1.0_c_double]
    active = 1_c_int
    period = 2.0_c_double * pi * sqrt(1.1_c_double ** 3)
    before = elements_of_second(mass, pos, vel)
    momentum_before = mass(1) * vel(:,1) + mass(2) * vel(:,2)
    status = os_advance(2_c_int, mass, radius, drag, active, pos, vel, acc, 0_c_int, &
                        period / 1000.0_c_double, 1.0_c_double, 0.0_c_double, 1000_c_int, &
                        options, report, c_null_ptr, 0_c_int)
    call check(status == 0_c_int, 'drag integration')
    after = elements_of_second(mass, pos, vel)
    decay = after%semi_major_axis_m - before%semi_major_axis_m
    expected = -1.0e-3_c_double * exp(-1.0_c_double) * sqrt(1.1_c_double) * period
    call check(abs(decay / expected - 1.0_c_double) < 0.05_c_double, 'drag orbital decay rate')
    momentum_after = mass(1) * vel(:,1) + mass(2) * vel(:,2)
    call check(maxval(abs(momentum_after - momentum_before)) < &
               1.0e-12_c_double * mass(2) * sqrt(1.0_c_double / 1.1_c_double), &
               'drag conserves total momentum')
  end subroutine

  ! Test particle on a = 1, e = 0.5 around M = 1 with c = 100 (mu / c^2 a = 1e-4);
  ! Yoshida, 2000 steps per orbit, 40 orbits. Periapsis advance per orbit is
  ! 6 pi mu / (c^2 a (1 - e^2)) (measured error 0.6%, tol 2%). Without 1PN the
  ! numerical precession is below 1e-5 rad.
  subroutine test_1pn_precession()
    real(c_double) :: mass(2), pos(3,2), vel(3,2), predicted, measured
    type(os_options) :: options
    type(os_report) :: report
    type(os_elements) :: before, after
    options = default_options()
    options%integrator = integrator_yoshida4
    options%central_index = 0_c_int
    options%light_speed_m_s = 100.0_c_double
    call central_orbit(1.0_c_double, 0.0_c_double, kepler(1.0_c_double, 0.5_c_double, &
      0.0_c_double, 0.0_c_double, 0.0_c_double, 0.0_c_double), mass, pos, vel)
    before = elements_of_second(mass, pos, vel)
    call check(advance(2, mass, pos, vel, 2.0_c_double * pi / 2000.0_c_double, 80000, options, &
                       report) == 0_c_int, '1PN integration')
    after = elements_of_second(mass, pos, vel)
    measured = angle_difference(after%argument_periapsis_rad, before%argument_periapsis_rad)
    predicted = 40.0_c_double * 6.0_c_double * pi / (1.0e4_c_double * 0.75_c_double)
    call check(abs(measured / predicted - 1.0_c_double) < 0.02_c_double, '1PN perihelion advance')

    options%light_speed_m_s = 0.0_c_double
    call central_orbit(1.0_c_double, 0.0_c_double, kepler(1.0_c_double, 0.5_c_double, &
      0.0_c_double, 0.0_c_double, 0.0_c_double, 0.0_c_double), mass, pos, vel)
    call check(advance(2, mass, pos, vel, 2.0_c_double * pi / 2000.0_c_double, 80000, options, &
                       report) == 0_c_int, 'Newtonian reference integration')
    after = elements_of_second(mass, pos, vel)
    call check(abs(angle_difference(after%argument_periapsis_rad, before%argument_periapsis_rad)) &
               < 1.0e-5_c_double, 'no spurious Newtonian precession')
  end subroutine

  ! Equal masses m = 1 + 1 on a relative orbit a = 1, e = 0.5 with c = 100;
  ! Yoshida, 2000 steps per orbit, 40 orbits. The periapsis of the relative orbit
  ! advances 6 pi G (m1 + m2) / (c^2 a (1 - e^2)) per orbit (tol 2%), twice the
  ! test-particle value around one of the masses; total momentum is conserved
  ! (tol 1e-12 of the initial momentum of the moving body).
  subroutine test_1pn_equal_masses()
    real(c_double) :: mass(2), pos(3,2), vel(3,2), predicted, measured, momentum(3)
    type(os_options) :: options
    type(os_report) :: report
    type(os_elements) :: before, after
    options = default_options()
    options%integrator = integrator_yoshida4
    options%central_index = 0_c_int
    options%light_speed_m_s = 100.0_c_double
    call central_orbit(1.0_c_double, 1.0_c_double, kepler(1.0_c_double, 0.5_c_double, &
      0.0_c_double, 0.0_c_double, 0.0_c_double, 0.0_c_double), mass, pos, vel)
    momentum = mass(1) * vel(:,1) + mass(2) * vel(:,2)
    before = elements_of_second(mass, pos, vel)
    call check(advance(2, mass, pos, vel, 2.0_c_double * pi / sqrt(2.0_c_double) / 2000.0_c_double, &
                       80000, options, report) == 0_c_int, 'equal-mass 1PN integration')
    after = elements_of_second(mass, pos, vel)
    measured = angle_difference(after%argument_periapsis_rad, before%argument_periapsis_rad)
    predicted = 40.0_c_double * 6.0_c_double * pi * 2.0_c_double / (1.0e4_c_double * 0.75_c_double)
    call check(abs(measured / predicted - 1.0_c_double) < 0.02_c_double, 'equal-mass 1PN periapsis advance')
    call check(maxval(abs(mass(1) * vel(:,1) + mass(2) * vel(:,2) - momentum)) < &
               1.0e-12_c_double * maxval(abs(momentum)), 'equal-mass 1PN conserves momentum')
  end subroutine

  ! Head-on bodies (m = 2 and 1, v = +1 and -1, radii 0.1) with G = 1e-9 merge
  ! into m = 3 with v = 1/3 (momentum, tol 1e-14) and radius (2e-3)^(1/3); a
  ! test particle aimed at a body of radius 0.1 is absorbed.
  subroutine test_collisions()
    real(c_double) :: mass(3), radius(3), drag(3), pos(3,3), vel(3,3), acc(3,3)
    integer(c_int) :: active(3), status
    type(os_options) :: options
    type(os_report) :: report
    type(os_event), target :: events(4)
    options = default_options()
    options%collisions = 1_c_int
    mass = [2.0_c_double, 1.0_c_double, 0.0_c_double]
    radius = [0.1_c_double, 0.1_c_double, 0.0_c_double]
    drag = 0.0_c_double
    active = [1_c_int, 1_c_int, 0_c_int]
    pos = 0.0_c_double
    vel = 0.0_c_double
    pos(1,1) = -1.0_c_double
    pos(1,2) = 1.0_c_double
    vel(1,1) = 1.0_c_double
    vel(1,2) = -1.0_c_double
    status = os_advance(3_c_int, mass, radius, drag, active, pos, vel, acc, 0_c_int, 0.01_c_double, &
                        1.0e-9_c_double, 0.0_c_double, 200_c_int, options, report, c_loc(events), 4_c_int)
    call check(status == 0_c_int .and. report%collisions == 1_c_int, 'merge happened')
    call check(active(1) == 1_c_int .and. active(2) == 0_c_int, 'lighter body absorbed')
    call check(abs(mass(1) - 3.0_c_double) < 1.0e-14_c_double, 'merged mass')
    call check(abs(vel(1,1) - 1.0_c_double / 3.0_c_double) < 1.0e-14_c_double, 'merge conserves momentum')
    call check(abs(radius(1) - (2.0e-3_c_double) ** (1.0_c_double / 3.0_c_double)) < 1.0e-14_c_double, &
               'merged radius conserves volume')
    call check(report%event_count == 1_c_int .and. events(1)%kind == event_collision .and. &
               events(1)%body == 1_c_int .and. events(1)%other == 0_c_int, 'collision event')

    mass = [1.0_c_double, 0.0_c_double, 0.0_c_double]
    radius = [0.1_c_double, 0.0_c_double, 0.0_c_double]
    active = [1_c_int, 1_c_int, 0_c_int]
    pos = 0.0_c_double
    vel = 0.0_c_double
    pos(1,2) = 1.0_c_double
    vel(1,2) = -1.0_c_double
    status = os_advance(3_c_int, mass, radius, drag, active, pos, vel, acc, 0_c_int, 0.01_c_double, &
                        1.0e-9_c_double, 0.0_c_double, 200_c_int, options, report, c_loc(events), 4_c_int)
    call check(status == 0_c_int .and. active(2) == 0_c_int .and. same(mass(1), 1.0_c_double), &
               'test particle absorbed without mass change')
  end subroutine

  ! m = 1e-9 on a = 1, e = 0.5 around M = 1 starting at apoapsis; Verlet, 1000
  ! steps per orbit, 2.75 orbits: periapsis at 0.5, 1.5, 2.5 orbits (steps 500,
  ! 1500, 2500, tol 2 steps) at r = 0.5 (tol 1e-4), apoapsis at 1 and 2 orbits.
  ! A capacity of 2 keeps the first two events and counts the rest as dropped.
  subroutine test_turning_point_events()
    real(c_double) :: mass(2), radius(2), drag(2), pos(3,2), vel(3,2), acc(3,2), period
    integer(c_int) :: active(2), status, periapsis_count, apoapsis_count, k
    type(os_options) :: options
    type(os_report) :: report
    type(os_event), target :: events(16)
    options = default_options()
    call central_orbit(1.0_c_double, 1.0e-9_c_double, kepler(1.0_c_double, 0.5_c_double, &
      0.0_c_double, 0.0_c_double, 0.0_c_double, pi), mass, pos, vel)
    radius = 0.0_c_double
    drag = 0.0_c_double
    active = 1_c_int
    period = 2.0_c_double * pi / sqrt(1.0_c_double + 1.0e-9_c_double)
    status = os_advance(2_c_int, mass, radius, drag, active, pos, vel, acc, 0_c_int, &
                        period / 1000.0_c_double, 1.0_c_double, 0.0_c_double, 2750_c_int, &
                        options, report, c_loc(events), 16_c_int)
    call check(status == 0_c_int, 'event orbit integration')
    periapsis_count = count(events(1:report%event_count)%kind == event_periapsis)
    apoapsis_count = count(events(1:report%event_count)%kind == event_apoapsis)
    call check(periapsis_count == 3_c_int .and. apoapsis_count == 2_c_int, 'turning point count')
    do k = 1, report%event_count
      if (events(k)%kind /= event_periapsis) cycle
      call check(abs(events(k)%distance_m - 0.5_c_double) < 1.0e-4_c_double, 'periapsis distance')
      call check(any(abs(events(k)%step - [500_c_int, 1500_c_int, 2500_c_int]) <= 2_c_int), &
                 'periapsis timing')
      call check(events(k)%body == 1_c_int .and. events(k)%other == 0_c_int, 'periapsis bodies')
    end do

    call central_orbit(1.0_c_double, 1.0e-9_c_double, kepler(1.0_c_double, 0.5_c_double, &
      0.0_c_double, 0.0_c_double, 0.0_c_double, pi), mass, pos, vel)
    status = os_advance(2_c_int, mass, radius, drag, active, pos, vel, acc, 0_c_int, &
                        period / 1000.0_c_double, 1.0_c_double, 0.0_c_double, 2750_c_int, &
                        options, report, c_loc(events), 2_c_int)
    call check(report%event_count == 2_c_int .and. report%events_dropped == 3_c_int, &
               'event buffer overflow is counted')
  end subroutine

  ! Satellite (m = 1e-6) bound to A (M = 1) at r = 1 with v = 1.36, perturbed by
  ! B (M = 0.5) passing at x = 1.6 with v = 3; Yoshida, dt = 1e-4, 40000 steps.
  ! Escape events of the satellite must match, step for step, the bound -> unbound
  ! transitions of its specific energy relative to A computed by os_orbital_elements.
  subroutine test_escape_events()
    real(c_double) :: mass(3), radius(3), drag(3), pos(3,3), vel(3,3), acc(3,3)
    real(c_double) :: start_mass(3), start_pos(3,3), start_vel(3,3)
    integer(c_int) :: active(3), status, step, transitions, escapes, valid(3)
    integer(c_int), allocatable :: transition_steps(:), escape_steps(:)
    type(os_options) :: options
    type(os_report) :: report
    type(os_event), target :: events(64)
    type(os_elements) :: elements(3)
    logical :: was_bound, is_bound
    options = default_options()
    options%integrator = integrator_yoshida4
    start_mass = [1.0_c_double, 1.0e-6_c_double, 0.5_c_double]
    start_pos = 0.0_c_double
    start_vel = 0.0_c_double
    start_pos(:,2) = [1.0_c_double, 0.0_c_double, 0.0_c_double]
    start_vel(:,2) = [0.0_c_double, 1.36_c_double, 0.0_c_double]
    start_pos(:,3) = [1.6_c_double, -6.0_c_double, 0.0_c_double]
    start_vel(:,3) = [0.0_c_double, 3.0_c_double, 0.0_c_double]
    radius = 0.0_c_double
    drag = 0.0_c_double
    active = 1_c_int

    mass = start_mass
    pos = start_pos
    vel = start_vel
    status = os_advance(3_c_int, mass, radius, drag, active, pos, vel, acc, 0_c_int, 1.0e-4_c_double, &
                        1.0_c_double, 0.0_c_double, 40000_c_int, options, report, c_loc(events), 64_c_int)
    call check(status == 0_c_int, 'escape scenario integration')
    escapes = count(events(1:report%event_count)%kind == event_escape .and. &
                    events(1:report%event_count)%body == 1_c_int)
    escape_steps = pack(events(1:report%event_count)%step, &
      events(1:report%event_count)%kind == event_escape .and. events(1:report%event_count)%body == 1_c_int)

    mass = start_mass
    pos = start_pos
    vel = start_vel
    allocate(transition_steps(0))
    transitions = 0
    was_bound = .true.
    do step = 1, 40000
      status = os_advance(3_c_int, mass, radius, drag, active, pos, vel, acc, &
                          merge(1_c_int, 0_c_int, step > 1), 1.0e-4_c_double, 1.0_c_double, &
                          0.0_c_double, 1_c_int, options, report, c_null_ptr, 0_c_int)
      status = os_orbital_elements(3_c_int, mass, active, pos, vel, 1.0_c_double, 0_c_int, &
                                   elements, valid)
      is_bound = elements(2)%specific_energy_j_kg < 0.0_c_double
      if (was_bound .and. .not. is_bound) then
        transitions = transitions + 1
        transition_steps = [transition_steps, step]
      end if
      was_bound = is_bound
    end do
    call check(escapes >= 1_c_int .and. escapes == transitions, 'escape events match energy sign')
    call check(all(escape_steps == transition_steps), 'escape event steps')
  end subroutine

  ! Eccentric binary (e = 0.6): 1000 Verlet or Yoshida steps forward, then 1000
  ! with -dt, returns to the initial state (time reversibility, tol 1e-11).
  subroutine test_time_reversal()
    integer(c_int) :: integrator
    real(c_double) :: mass(2), pos(3,2), vel(3,2), initial_pos(3,2), initial_vel(3,2), rel(3), relv(3)
    integer(c_int) :: status
    type(os_options) :: options
    type(os_report) :: report
    do integrator = integrator_verlet, integrator_yoshida4
      options = default_options()
      options%integrator = integrator
      mass = 1.0_c_double
      status = os_elements_to_state(1.0_c_double, 1.0_c_double, 1.0_c_double, &
        kepler(1.0_c_double, 0.6_c_double, 0.0_c_double, 0.0_c_double, 0.0_c_double, 1.0_c_double), &
        rel, relv)
      pos(:,1) = -0.5_c_double * rel
      pos(:,2) = 0.5_c_double * rel
      vel(:,1) = -0.5_c_double * relv
      vel(:,2) = 0.5_c_double * relv
      initial_pos = pos
      initial_vel = vel
      call check(advance(2, mass, pos, vel, 2.0e-3_c_double, 1000, options, report) == 0_c_int, &
                 'forward integration')
      call check(advance(2, mass, pos, vel, -2.0e-3_c_double, 1000, options, report) == 0_c_int, &
                 'backward integration')
      call check(maxval(abs(pos - initial_pos)) < 1.0e-11_c_double .and. &
                 maxval(abs(vel - initial_vel)) < 1.0e-11_c_double, 'time reversibility')
    end do
  end subroutine

  ! One orbit of a relative e = 0.5 binary: smallest separation equals the
  ! periapsis 0.5 (tol 1e-4) and the suggested step is 2 pi sqrt(r^3 / G M) / 200
  ! at that separation (tol 1e-3 relative). A single body has no pairs.
  subroutine test_report()
    real(c_double) :: mass(2), pos(3,2), vel(3,2), rel(3), relv(3), one_mass(1), one_pos(3,1), one_vel(3,1)
    integer(c_int) :: status
    type(os_options) :: options
    type(os_report) :: report
    options = default_options()
    mass = 1.0_c_double
    status = os_elements_to_state(1.0_c_double, 1.0_c_double, 1.0_c_double, &
      kepler(1.0_c_double, 0.5_c_double, 0.0_c_double, 0.0_c_double, 0.0_c_double, pi), rel, relv)
    pos(:,1) = -0.5_c_double * rel
    pos(:,2) = 0.5_c_double * rel
    vel(:,1) = -0.5_c_double * relv
    vel(:,2) = 0.5_c_double * relv
    call check(advance(2, mass, pos, vel, 2.0_c_double * pi / sqrt(2.0_c_double) / 2000.0_c_double, &
                       2000, options, report) == 0_c_int, 'report orbit')
    call check(abs(report%min_separation_m - 0.5_c_double) < 1.0e-4_c_double, 'minimum separation')
    call check(abs(report%suggested_time_step_s / &
      (2.0_c_double * pi * sqrt(0.125_c_double / 2.0_c_double) / 200.0_c_double) - 1.0_c_double) &
      < 1.0e-3_c_double, 'suggested time step')

    call check(same(report%massive_suggested_time_step_s, report%suggested_time_step_s), &
               'massive suggestion equals the overall one without particles')
    call check_particle_does_not_drive_massive_suggestion()

    one_mass = 1.0_c_double
    one_pos = 0.0_c_double
    one_vel = 0.0_c_double
    call check(advance(1, one_mass, one_pos, one_vel, 1.0_c_double, 1, options, report) == 0_c_int .and. &
               report%min_separation_m < 0.0_c_double .and. report%suggested_time_step_s < 0.0_c_double, &
               'single body report')
  end subroutine

  ! A test particle grazing the star at r = 0.01 sets the overall suggestion but not the
  ! massive one, set by the planet at r = 1: the ratio is (1 / 0.01)^1.5 / sqrt(1.001)
  ! (G M = 1 for the particle, G (M + m) = 1.001 for the planet; tol 1%).
  subroutine check_particle_does_not_drive_massive_suggestion()
    real(c_double) :: mass(3), pos(3,3), vel(3,3)
    type(os_report) :: report
    mass = [1.0_c_double, 1.0e-3_c_double, 0.0_c_double]
    pos = 0.0_c_double
    vel = 0.0_c_double
    pos(1,2) = 1.0_c_double
    vel(2,2) = 1.0_c_double
    pos(1,3) = 0.01_c_double
    vel(2,3) = 10.0_c_double
    call check(advance(3, mass, pos, vel, 1.0e-6_c_double, 1, default_options(), report) == 0_c_int, &
               'particle report step')
    call check(abs(report%massive_suggested_time_step_s / report%suggested_time_step_s / &
               (1.0e3_c_double / sqrt(1.001_c_double)) - 1.0_c_double) < 0.01_c_double, &
               'massive suggestion ignores test particles')
  end subroutine

  ! Invalid inputs return status 1; a coincident pair without softening returns
  ! status 2. Neither changes any caller buffer, including the event buffer.
  subroutine test_validation_and_preservation()
    real(c_double) :: mass(2), radius(2), drag(2), pos(3,2), vel(3,2), acc(3,2)
    integer(c_int) :: active(2), status
    type(os_options) :: options
    type(os_report) :: report
    type(os_event), target :: events(2)

    call circular_binary(mass, pos, vel)
    radius = 0.0_c_double
    drag = 0.0_c_double
    active = 1_c_int
    options = default_options()
    options%integrator = 7_c_int
    call check(call_status() == 1_c_int, 'unknown integrator rejected')
    options = default_options()
    options%central_index = 2_c_int
    call check(call_status() == 1_c_int, 'central index out of range rejected')
    options = default_options()
    options%j2 = 1.0e-3_c_double
    call check(call_status() == 1_c_int, 'J2 without central body rejected')
    options = default_options()
    options%central_index = 0_c_int
    options%atmosphere_density_kg_m3 = 1.0_c_double
    call check(call_status() == 1_c_int, 'atmosphere without radius rejected')
    options = default_options()
    mass(2) = -1.0_c_double
    call check(call_status() == 1_c_int, 'negative mass rejected')
    mass(2) = 1.0_c_double
    active(2) = 2_c_int
    call check(call_status() == 1_c_int, 'invalid active flag rejected')
    active(2) = 1_c_int
    call check(os_advance(2_c_int, mass, radius, drag, active, pos, vel, acc, 0_c_int, 0.0_c_double, &
      1.0_c_double, 0.0_c_double, 1_c_int, options, report, c_null_ptr, 0_c_int) == 1_c_int, &
      'zero time step rejected')
    call check(os_step(2_c_int, mass, pos, vel, -1.0e-3_c_double, 1.0_c_double, 0.0_c_double, 1_c_int) &
               == 1_c_int, 'legacy step keeps positive dt contract')

    mass = [1.0_c_double, 1.0_c_double]
    radius = [0.5_c_double, 0.25_c_double]
    active = 1_c_int
    pos = 0.0_c_double
    vel = 0.0_c_double
    acc = 7.0_c_double
    events%kind = 99_c_int
    options%collisions = 1_c_int
    status = os_advance(2_c_int, mass, radius, drag, active, pos, vel, acc, 0_c_int, 0.01_c_double, &
                        1.0_c_double, 0.0_c_double, 1_c_int, options, report, c_loc(events), 2_c_int)
    call check(status == 2_c_int, 'coincident bodies status')
    call check(all(same(mass, 1.0_c_double)) .and. same(radius(1), 0.5_c_double) .and. &
               same(radius(2), 0.25_c_double) .and. all(active == 1_c_int) .and. &
               all(same(pos, 0.0_c_double)) .and. all(same(vel, 0.0_c_double)) .and. &
               all(same(acc, 7.0_c_double)) .and. all(events%kind == 99_c_int), &
               'failure preserves every caller buffer')

  contains

    integer(c_int) function call_status()
      call_status = os_advance(2_c_int, mass, radius, drag, active, pos, vel, acc, 0_c_int, &
                               1.0e-3_c_double, 1.0_c_double, 0.0_c_double, 1_c_int, options, report, &
                               c_null_ptr, 0_c_int)
    end function
  end subroutine
end module
