#ifndef ORBITALSIM_H
#define ORBITALSIM_H

#ifdef __cplusplus
extern "C" {
#endif

/* Positions and velocities use body-major xyz layout: [x0,y0,z0,x1,y1,z1,...].
 * All pointers must address at least n (mass) or 3*n (other arrays) doubles.
 * os_step updates pos and vel only on success.
 * Status: 0 success; 1 invalid input; 2 coincident bodies without softening;
 *         3 non-finite result; 4 allocation failure.
 */
int os_step(int n, const double *mass, double *pos, double *vel,
            double dt, double grav, double eps, int steps);

int os_diagnostics(int n, const double *mass, const double *pos,
                   const double *vel, double grav, double eps,
                   double *energy, double *momentum, double *angular_momentum);

#ifdef __cplusplus
}
#endif

#endif
