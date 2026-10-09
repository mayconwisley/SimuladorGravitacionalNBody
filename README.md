# OrbitalSim

Simulador gravitacional N-body com motor de cálculo em Fortran moderna e
aplicação de linha de comando em .NET 10. A gravitação é calculada por pares;
Velocity Verlet integra posições e velocidades com passo fixo. A CLI lê um
cenário JSON e exporta trajetória, diagnósticos e resumo. A biblioteca nativa
também expõe uma ABI C pequena para outros clientes.

## Estrutura

- `native/src/`: forças, integração, diagnósticos e ABI C.
- `native/include/orbitalsim.h`: contrato da biblioteca compartilhada.
- `src/OrbitalSim.Domain/`: cenário, corpos, unidades e validação.
- `src/OrbitalSim.Application/`: execução e amostragem da simulação.
- `src/OrbitalSim.Infrastructure.Fortran/`: P/Invoke com `LibraryImport`.
- `src/OrbitalSim.Cli/`: entrada JSON, exportação CSV/JSON e benchmarks.
- `tests/native/` e `tests/OrbitalSim.IntegrationTests/`: testes nativos e .NET.
- `examples/`: cenários prontos.

## Requisitos e build no Windows

Requisitos: .NET SDK 10 e GNU Fortran. O script abaixo usa por padrão
`C:\Programas\TDM-GCC-64\bin\gfortran.exe`. A partir da raiz do projeto:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\build-all.ps1
```

O script compila a DLL e os testes Fortran, executa os testes nativos, restaura
e compila a solução .NET em Release e executa os testes de integração. Para um
compilador em outro local, passe `-Compiler "C:\caminho\gfortran.exe"`.
Para reconstruir somente o motor, execute `scripts/build-tdm.ps1`.

Alternativamente, com CMake 3.20+, Ninja e um compilador Fortran disponíveis:

```sh
cmake -S . -B build -G Ninja -DCMAKE_BUILD_TYPE=Release
cmake --build build
ctest --test-dir build --output-on-failure
dotnet restore OrbitalSim.sln -m:1 -p:NuGetAudit=false
dotnet build OrbitalSim.sln -c Release --no-restore -m:1
dotnet run --project tests/OrbitalSim.IntegrationTests -c Release --no-build
```

No Windows, o terminal [MSYS2 UCRT64](https://www.msys2.org/) pode fornecer
GNU Fortran, CMake e Ninja:

```sh
pacman -Syu
pacman -S --needed mingw-w64-ucrt-x86_64-gcc-fortran mingw-w64-ucrt-x86_64-cmake mingw-w64-ucrt-x86_64-ninja
```

## Executar uma simulação

```powershell
dotnet run --project src/OrbitalSim.Cli -c Release --no-build -- run examples/earth-satellite.json --out output/earth-satellite
```

O diretório de saída terá:

- `trajectory.csv`: uma linha por corpo e amostra, com posição e velocidade.
- `diagnostics.csv`: energia, momento linear e momento angular por amostra.
- `summary.json`: energia inicial/final, deriva e quantidade de passos/amostras.

O CSV inclui o estado inicial, estados a cada `sampleEverySteps` e o estado
final, mesmo quando o último intervalo é menor. A saída é escrita
sequencialmente; o uso de memória cresce com o número de corpos, não com o
número de amostras.

Formato do cenário:

```json
{
  "gravity": 6.67430e-11,
  "softeningMeters": 0,
  "timeStepSeconds": 5,
  "steps": 1200,
  "sampleEverySteps": 20,
  "bodies": [
    {
      "name": "Earth",
      "massKg": 5.972e24,
      "positionMeters": [0, 0, 0],
      "velocityMetersPerSecond": [0, 0, 0]
    },
    {
      "name": "Satellite",
      "massKg": 1000,
      "positionMeters": [7000000, 0, 0],
      "velocityMetersPerSecond": [0, 7545.947, 0]
    }
  ]
}
```

Use unidades SI: kg, m, s e `gravity` em m³/(kg·s²). As massas devem ser
positivas; posições e velocidades são vetores `[x,y,z]`. Nomes dos corpos
devem ser únicos. Escolha um passo pequeno em relação ao período orbital e
examine `diagnostics.csv` para avaliar a precisão. Com `softeningMeters = 0`,
corpos coincidentes geram erro.

## Benchmark

```powershell
dotnet run --project src/OrbitalSim.Cli -c Release --no-build -- benchmark --bodies 2,100,1000 --steps 100 --repeats 5 --batch 10 --out benchmarks/results.csv
```

O benchmark informa tempo, passos por segundo, interações por segundo,
alocações gerenciadas e deriva relativa de energia. Veja
[benchmarks/README.md](benchmarks/README.md) para a metodologia. O arquivo
`benchmarks/results.csv` é local e ignorado pelo controle de versão.

## Modelo numérico e ABI

Para `delta = r_j - r_i`, a aceleração usa
`G*m_j*delta/(|delta|² + eps²)^(3/2)`. A energia potencial correspondente é
`-G*m_i*m_j/sqrt(|delta|² + eps²)`. `eps=0` recupera a força newtoniana entre
corpos distintos. Cada passo de Velocity Verlet calcula a aceleração nas
posições antiga e nova. O custo é O(N²) em tempo por passo e O(N) em memória
adicional. Não há colisão/fusão, passo adaptativo ou aproximação para N grande.

O cabeçalho [native/include/orbitalsim.h](native/include/orbitalsim.h) define
`os_step` e `os_diagnostics`. `mass` contém N valores `double`; `pos` e `vel`
contêm `3*N` valores contíguos, na ordem `x,y,z` por corpo. `os_step` só altera
os buffers em sucesso. Códigos: 0 sucesso, 1 entrada inválida, 2 corpos
coincidentes sem suavização, 3 resultado não finito, 4 falha de alocação.
Ponteiros nulos ou buffers menores que o contrato violam a ABI; o adaptador
.NET valida seus tamanhos antes de chamar o código nativo.

## Estado e limites

O motor Fortran, a CLI .NET e os benchmarks estão implementados. Não há API
HTTP nem interface React nesta versão; React permanece opcional. Para uso
científico, valide passo, unidades, suavização e invariantes em cada cenário.
