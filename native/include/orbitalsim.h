#ifndef ORBITALSIM_H
#define ORBITALSIM_H

#ifdef __cplusplus
extern "C" {
#endif

/* OrbitalSim native motor. All quantities are SI (m, kg, s, rad).
 * Positions, velocities and accelerations use body-major xyz layout:
 * [x0,y0,z0,x1,y1,z1,...]. Array pointers must address at least n (scalars)
 * or 3*n (vectors) values. Indices are 0-based.
 *
 * Status codes: 0 success; 1 invalid input; 2 coincident bodies without
 * softening; 3 non-finite result; 4 allocation failure. On any non-zero status
 * the caller's state buffers (mass, radius, active, pos, vel, acc) and the event
 * buffer are left unchanged.
 *
 * Gravity uses the Plummer softening |r|^2 + eps^2 for forces and potential.
 * A body with mass 0 is a test particle: it feels gravity but exerts none.
 */

enum {
  OS_INTEGRATOR_VERLET = 0,   /* 2nd order, symplectic, 1 force evaluation/step */
  OS_INTEGRATOR_YOSHIDA4 = 1, /* 4th order, symplectic, 3 force evaluations/step */
  OS_INTEGRATOR_RK4 = 2       /* 4th order, not symplectic, 4 force evaluations/step */
};

enum {
  OS_EVENT_COLLISION = 1,     /* body merged into (or absorbed by) other */
  OS_EVENT_PERIAPSIS = 2,     /* closest approach to the reference body (e >= 0.01) */
  OS_EVENT_APOAPSIS = 3,      /* farthest point of a bound orbit (e >= 0.01) */
  OS_EVENT_ESCAPE = 4         /* orbit relative to the reference became unbound */
};

/* External physics is applied by the central body (central_index, -1 = none) to
 * every other active body, with the reaction on the central body:
 *  - J2 oblateness about the inertial z axis (needs central_radius_m > 0);
 *  - drag in an exponential atmosphere rho0 exp(-(r - R) / H) using each body's
 *    drag_area_per_mass = Cd A / m (m^2/kg), relative to the central body;
 *  - 1PN (Schwarzschild, harmonic gauge) correction when light_speed_m_s > 0.
 * Drag and 1PN depend on velocity, so the integrators lose symplecticity. */
typedef struct os_options {
  int integrator;                    /* OS_INTEGRATOR_* */
  int central_index;                 /* -1 disables J2, drag and 1PN */
  int collisions;                    /* 0 off, 1 merge bodies whose radii overlap */
  int reserved;                      /* set to 0 */
  double j2;                         /* dimensionless */
  double central_radius_m;
  double atmosphere_density_kg_m3;   /* at central_radius_m; 0 disables drag */
  double atmosphere_scale_height_m;
  double light_speed_m_s;            /* 0 disables 1PN */
} os_options;

typedef struct os_report {
  double min_separation_m;           /* smallest separation seen; -1 if no pair */
  double min_dynamical_time_s;       /* min sqrt(r^3 / (G (m_i + m_j))); -1 if none */
  double suggested_time_step_s;      /* 2 pi min_dynamical_time / 200; -1 if none */
  double massive_suggested_time_step_s; /* same, massive pairs only (ignores test
                                           particles); -1 if fewer than two massive */
  int event_count;                   /* events written to the buffer */
  int events_dropped;                /* events that did not fit */
  int collisions;                    /* merges performed */
  int reserved;
} os_report;

typedef struct os_event {
  int kind;                          /* OS_EVENT_* */
  int step;                          /* 1-based step inside the call */
  int body;
  int other;                         /* survivor (collision) or reference body */
  double distance_m;
} os_event;

/* Osculating elements relative to a reference body. Hyperbolic orbits have a
 * negative semi-major axis; period_s and apoapsis_m are 0 when unbound. */
typedef struct os_elements {
  double semi_major_axis_m;
  double eccentricity;
  double inclination_rad;
  double ascending_node_rad;
  double argument_periapsis_rad;
  double true_anomaly_rad;
  double period_s;
  double periapsis_m;
  double apoapsis_m;
  double specific_energy_j_kg;
} os_elements;

/* Legacy: Velocity Verlet with positive masses, dt > 0 and no extra physics.
 * Updates pos and vel only on success. */
int os_step(int n, const double *mass, double *pos, double *vel,
            double dt, double grav, double eps, int steps);

/* Legacy: total energy (J), momentum (kg m/s) and angular momentum (kg m^2/s)
 * of n bodies with positive masses. */
int os_diagnostics(int n, const double *mass, const double *pos,
                   const double *vel, double grav, double eps,
                   double *energy, double *momentum, double *angular_momentum);

/* Advances `steps` steps of size dt (dt != 0; negative integrates backwards).
 * mass, radius, active, pos and vel are updated in place (collisions merge
 * bodies and clear `active` of the absorbed one). acc holds the accelerations of
 * the input state when acc_ready != 0 and always receives those of the output
 * state, so consecutive calls avoid recomputing them. events may be NULL when
 * event_capacity is 0. Inactive bodies are ignored by every computation. */
int os_advance(int n, double *mass, double *radius, const double *drag_area_per_mass,
               int *active, double *pos, double *vel, double *acc, int acc_ready,
               double dt, double grav, double eps, int steps,
               const os_options *options, os_report *report,
               os_event *events, int event_capacity);

/* Kinetic and potential energy (J, potential includes the central J2 term),
 * linear and angular momentum of the active bodies. */
int os_energy(int n, const double *mass, const int *active, const double *pos,
              const double *vel, double grav, double eps, const os_options *options,
              double *kinetic, double *potential, double *momentum,
              double *angular_momentum);

/* Elements of every active body relative to `reference` (-1 selects the most
 * massive active body); valid[i] is 1 when elements[i] is defined. */
int os_orbital_elements(int n, const double *mass, const int *active,
                        const double *pos, const double *vel, double grav,
                        int reference, os_elements *elements, int *valid);

/* State of a body relative to its central body from a, e, inclination, node,
 * argument of periapsis and true anomaly (other fields are ignored). Ellipses
 * need a > 0 and 0 <= e < 1; hyperbolas a < 0 and e > 1. */
int os_elements_to_state(double grav, double central_mass, double body_mass,
                         const os_elements *elements, double *pos, double *vel);

#ifdef __cplusplus
}
#endif

#endif
