cmake_minimum_required(VERSION 3.20)
project(OrbitalSim VERSION 0.1.0 LANGUAGES Fortran)

file(MAKE_DIRECTORY "${CMAKE_CURRENT_BINARY_DIR}/modules")

add_library(orbitalsim SHARED
    native/src/orbital_types.f90
    native/src/orbital_forces.f90
    native/src/orbital_diagnostics.f90
    native/src/orbital_elements.f90
    native/src/orbital_integrator.f90
    native/src/orbital_c_api.f90
)
set_target_properties(orbitalsim PROPERTIES
    Fortran_MODULE_DIRECTORY "${CMAKE_CURRENT_BINARY_DIR}/modules"
    WINDOWS_EXPORT_ALL_SYMBOLS ON
)
target_include_directories(orbitalsim PRIVATE "${CMAKE_CURRENT_BINARY_DIR}/modules")

include(CTest)
if(BUILD_TESTING)
    add_executable(orbital_native_tests tests/native/test_features.f90 tests/native/test_orbital.f90)
    target_link_libraries(orbital_native_tests PRIVATE orbitalsim)
    target_include_directories(orbital_native_tests PRIVATE "${CMAKE_CURRENT_BINARY_DIR}/modules")
    add_test(NAME orbital_native_tests COMMAND orbital_native_tests)
endif()
