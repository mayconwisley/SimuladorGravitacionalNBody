program test_orbital
  use iso_c_binding, only: c_int, c_double
  use orbital_c_api, only: os_step, os_diagnostics
  use test_features, only: run_feature_tests
  implicit none
  real(c_double), parameter :: pi = acos(-1.0_c_double)
  real(c_double) :: mass(2), pos(3,2), vel(3,2), initial_pos(3,2)
  real(c_double) :: energy_before, energy_after, momentum(3), angular(3)
  real(c_double) :: period, time_step, coarse_error, fine_error
  integer(c_int) :: status

  mass = 1.0_c_double
  pos = 0.0_c_double
  vel = 0.0_c_double
  pos(1,1) = -0.5_c_double
  pos(1,2) =  0.5_c_double
  vel(2,1) = -sqrt(0.5_c_double)
  vel(2,2) =  sqrt(0.5_c_double)
  initial_pos = pos

  status = os_diagnostics(2_c_int, mass, pos, vel, 1.0_c_double, &
                          0.0_c_double, energy_before, momentum, angular)
  call check(status == 0_c_int, 'initial diagnostics')
  call check(abs(energy_before + 0.5_c_double) < 1.0e-14_c_double, &
             'initial energy')
  call check(maxval(abs(momentum)) < 1.0e-14_c_double, 'initial momentum')

  period = 2.0_c_double * pi / sqrt(2.0_c_double)
  time_step = period / 10000.0_c_double
  status = os_step(2_c_int, mass, pos, vel, time_step, 1.0_c_double, &
                   0.0_c_double, 10000_c_int)
  call check(status == 0_c_int, 'one circular orbit')
  status = os_diagnostics(2_c_int, mass, pos, vel, 1.0_c_double, &
                          0.0_c_double, energy_after, momentum, angular)
  call check(status == 0_c_int, 'final diagnostics')
  call check(maxval(abs(pos - initial_pos)) < 1.0e-5_c_double, &
             'orbital closure')
  call check(abs(energy_after - energy_before) < 1.0e-8_c_double, &
             'energy drift')
  call check(maxval(abs(momentum)) < 1.0e-12_c_double, &
             'momentum conservation')
  call check(abs(angular(3) - sqrt(0.5_c_double)) < 1.0e-10_c_double, &
             'angular momentum conservation')

  coarse_error = orbit_closure_error(1000_c_int)
  fine_error = orbit_closure_error(2000_c_int)
  call check(coarse_error > 3.0_c_double * fine_error, &
             'second-order convergence')

  pos = 0.0_c_double
  vel = 0.0_c_double
  pos(1,1) = 2.0_c_double
  vel(2,1) = 3.0_c_double
  status = os_step(1_c_int, mass, pos, vel, 0.25_c_double, 1.0_c_double, &
                   0.0_c_double, 4_c_int)
  call check(status == 0_c_int, 'single body step')
  call check(abs(pos(2,1) - 3.0_c_double) < 1.0e-14_c_double, &
             'single body linear motion')
  call check(abs(vel(2,1) - 3.0_c_double) < 1.0e-14_c_double, &
             'single body constant velocity')

  pos = 0.0_c_double
  vel = 0.0_c_double
  status = os_step(2_c_int, mass, pos, vel, 0.01_c_double, 1.0_c_double, &
                   0.0_c_double, 1_c_int)
  call check(status == 2_c_int, 'coincident body error')
  call check(all(abs(pos) < tiny(0.0_c_double)) .and. &
             all(abs(vel) < tiny(0.0_c_double)), &
             'state unchanged on error')
  status = os_step(2_c_int, mass, pos, vel, 0.01_c_double, 1.0_c_double, &
                   0.1_c_double, 1_c_int)
  call check(status == 0_c_int, 'softened coincident bodies')

  status = os_step(2_c_int, mass, pos, vel, 0.0_c_double, 1.0_c_double, &
                   0.0_c_double, 1_c_int)
  call check(status == 1_c_int, 'invalid time step')

  call run_feature_tests()
  print *, 'All OrbitalSim native tests passed.'

contains

  subroutine check(condition, label)
    logical, intent(in) :: condition
    character(*), intent(in) :: label
    if (.not. condition) then
      print *, 'FAILED: ', label
      error stop 1
    end if
  end subroutine

  function orbit_closure_error(step_count) result(position_error)
    integer(c_int), intent(in) :: step_count
    real(c_double) :: position_error, local_pos(3,2), local_vel(3,2)
    integer(c_int) :: local_status

    local_pos = 0.0_c_double
    local_vel = 0.0_c_double
    local_pos(1,1) = -0.5_c_double
    local_pos(1,2) =  0.5_c_double
    local_vel(2,1) = -sqrt(0.5_c_double)
    local_vel(2,2) =  sqrt(0.5_c_double)
    local_status = os_step(2_c_int, mass, local_pos, local_vel, &
                           period / real(step_count, c_double), 1.0_c_double, &
                           0.0_c_double, step_count)
    call check(local_status == 0_c_int, 'convergence orbit step')
    position_error = maxval(abs(local_pos - initial_pos))
  end function
end program
