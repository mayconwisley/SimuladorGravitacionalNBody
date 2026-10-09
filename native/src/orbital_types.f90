module orbital_types
  ! C-interoperable records shared by the ABI. Units are SI unless stated.
  use iso_c_binding, only: c_int, c_double
  implicit none
  private
  public :: os_options, os_report, os_event, os_elements, default_options
  public :: integrator_verlet, integrator_yoshida4, integrator_rk4
  public :: event_collision, event_periapsis, event_apoapsis, event_escape

  integer(c_int), parameter :: integrator_verlet = 0_c_int
  integer(c_int), parameter :: integrator_yoshida4 = 1_c_int
  integer(c_int), parameter :: integrator_rk4 = 2_c_int

  integer(c_int), parameter :: event_collision = 1_c_int
  integer(c_int), parameter :: event_periapsis = 2_c_int
  integer(c_int), parameter :: event_apoapsis = 3_c_int
  integer(c_int), parameter :: event_escape = 4_c_int

  ! Integration and external-force settings. The central body (0-based index,
  ! -1 for none) is the source of J2, atmospheric drag and the 1PN correction.
  type, bind(C) :: os_options
    integer(c_int) :: integrator
    integer(c_int) :: central_index
    integer(c_int) :: collisions                 ! 0 off, 1 merge on contact
    integer(c_int) :: reserved                   ! must be 0
    real(c_double) :: j2                         ! dimensionless
    real(c_double) :: central_radius_m           ! equatorial radius
    real(c_double) :: atmosphere_density_kg_m3   ! at central_radius_m; 0 disables drag
    real(c_double) :: atmosphere_scale_height_m
    real(c_double) :: light_speed_m_s            ! > 0 enables the 1PN correction
  end type

  ! Summary of one os_advance call.
  type, bind(C) :: os_report
    real(c_double) :: min_separation_m           ! -1 when no massive pair exists
    real(c_double) :: min_dynamical_time_s       ! min sqrt(r^3 / (G (m_i + m_j))); -1 if none
    real(c_double) :: suggested_time_step_s      ! 2 pi min_dynamical_time / 200; -1 if none
    real(c_double) :: massive_suggested_time_step_s ! same, massive pairs only; -1 if none
    integer(c_int) :: event_count                ! events written to the caller buffer
    integer(c_int) :: events_dropped             ! events that did not fit
    integer(c_int) :: collisions                 ! merges performed
    integer(c_int) :: reserved
  end type

  type, bind(C) :: os_event
    integer(c_int) :: kind                       ! event_* constant
    integer(c_int) :: step                       ! 1-based step inside the call
    integer(c_int) :: body                       ! 0-based index
    integer(c_int) :: other                      ! 0-based survivor or reference body
    real(c_double) :: distance_m                 ! separation from `other` at the event
  end type

  ! Osculating Keplerian elements of a body relative to a reference body.
  type, bind(C) :: os_elements
    real(c_double) :: semi_major_axis_m          ! negative for hyperbolic, 0 for parabolic
    real(c_double) :: eccentricity
    real(c_double) :: inclination_rad
    real(c_double) :: ascending_node_rad
    real(c_double) :: argument_periapsis_rad
    real(c_double) :: true_anomaly_rad
    real(c_double) :: period_s                   ! 0 when unbound
    real(c_double) :: periapsis_m
    real(c_double) :: apoapsis_m                 ! 0 when unbound
    real(c_double) :: specific_energy_j_kg
  end type

contains

  pure function default_options() result(options)
    type(os_options) :: options
    options%integrator = integrator_verlet
    options%central_index = -1_c_int
    options%collisions = 0_c_int
    options%reserved = 0_c_int
    options%j2 = 0.0_c_double
    options%central_radius_m = 0.0_c_double
    options%atmosphere_density_kg_m3 = 0.0_c_double
    options%atmosphere_scale_height_m = 0.0_c_double
    options%light_speed_m_s = 0.0_c_double
  end function
end module
