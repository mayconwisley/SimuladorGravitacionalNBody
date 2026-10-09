module orbital_verlet
  use iso_c_binding, only: c_int, c_double
  use, intrinsic :: ieee_arithmetic, only: ieee_is_finite
  use orbital_forces, only: calculate_accelerations, validate_input
  implicit none
  private
  public :: advance_orbits

contains

  subroutine advance_orbits(n, mass, pos, vel, dt, grav, eps, steps, status)
    integer(c_int), intent(in) :: n, steps
    real(c_double), intent(in) :: mass(n), dt, grav, eps
    real(c_double), intent(inout) :: pos(3,n), vel(3,n)
    integer(c_int), intent(out) :: status
    real(c_double), allocatable :: work_pos(:,:), work_vel(:,:), old_acc(:,:), new_acc(:,:)
    integer :: allocation_status, step_index

    call validate_input(n, mass, pos, vel, dt, grav, eps, steps, status)
    if (status /= 0_c_int) return

    allocate(work_pos(3,n), work_vel(3,n), old_acc(3,n), new_acc(3,n), &
      stat=allocation_status)
    if (allocation_status /= 0) then
      status = 4_c_int
      return
    end if
    work_pos = pos
    work_vel = vel
    call calculate_accelerations(n, mass, work_pos, grav, eps, old_acc, status)
    if (status /= 0_c_int) return

    do step_index = 1, steps
      work_pos = work_pos + dt * work_vel + 0.5_c_double * dt * dt * old_acc
      if (.not. all(ieee_is_finite(work_pos))) then
        status = 3_c_int
        return
      end if
      call calculate_accelerations(n, mass, work_pos, grav, eps, new_acc, status)
      if (status /= 0_c_int) return
      work_vel = work_vel + 0.5_c_double * dt * (old_acc + new_acc)
      if (.not. all(ieee_is_finite(work_vel))) then
        status = 3_c_int
        return
      end if
      old_acc = new_acc
    end do

    pos = work_pos
    vel = work_vel
    status = 0_c_int
  end subroutine
end module
