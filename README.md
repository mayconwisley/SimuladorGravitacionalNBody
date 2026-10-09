# OrbitalSim

Simulador gravitacional **N-body** com motor numérico em Fortran moderna e
aplicação de linha de comando em **.NET 10**. O motor calcula a atração entre
todos os pares de corpos e integra as órbitas com Velocity Verlet. A aplicação
lê cenários em JSON e gera trajetórias e diagnósticos em arquivos simples de
analisar.

O projeto já executa simulações locais, inclui testes nativos e de integração e
oferece um comando de benchmark. API HTTP e interface React não fazem parte da
versão atual.

## Início rápido no Windows

Pré-requisitos:

- .NET SDK 10;
- GNU Fortran do TDM-GCC em `C:\Programas\TDM-GCC-64\bin\gfortran.exe`.

Na raiz do repositório, compile o motor e a solução .NET e execute os testes:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\build-all.ps1
```

Se o compilador estiver em outro local, informe seu caminho:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\build-all.ps1 -Compiler "C:\caminho\para\gfortran.exe"
```

Execute o cenário de exemplo:

```powershell
dotnet run --project src\OrbitalSim.Cli -c Release --no-build -- run examples\earth-satellite.json --out output\earth-satellite
```

Os arquivos serão criados em `output\earth-satellite`. O caminho após `--out`
pode ser alterado para cada execução.

## Resultados da simulação

| Arquivo | Conteúdo |
| --- | --- |
| `trajectory.csv` | Uma linha por corpo e amostra: passo, tempo, nome, massa, posição e velocidade. |
| `diagnostics.csv` | Uma linha por amostra: energia total, momento linear e momento angular. |
| `summary.json` | Quantidade de corpos, passos e amostras; tempo final; energia inicial e final; deriva de energia. |

A primeira amostra representa o estado inicial. Depois, o programa registra o
estado a cada `sampleEverySteps` passos e sempre inclui o último passo, mesmo
quando o intervalo final é menor. A exportação é sequencial: a memória usada
para amostras não cresce com a duração da simulação.

## Criar um cenário

Copie e edite [o exemplo Terra–satélite](examples/earth-satellite.json). O
arquivo usa esta estrutura:

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

| Campo | Significado e unidade |
| --- | --- |
| `gravity` | Constante gravitacional $G$, em m³/(kg·s²); deve ser positiva. |
| `softeningMeters` | Comprimento de suavização $\epsilon$, em m; zero usa a força newtoniana entre posições distintas. |
| `timeStepSeconds` | Duração fixa de cada passo, em s; deve ser positiva. |
| `steps` | Número total de passos; inteiro positivo. |
| `sampleEverySteps` | Intervalo de amostragem; inteiro positivo. |
| `bodies` | Corpos com nome único, massa positiva em kg, posição em m e velocidade em m/s. |

Posição e velocidade são vetores `[x, y, z]`. Todos os números devem ser
finitos. Com suavização zero, corpos na mesma posição causam erro. Para melhorar
a precisão, reduza o passo de tempo e compare a trajetória e os diagnósticos.

## Método numérico

Para os corpos $i$ e $j$, com $\Delta\mathbf r=\mathbf r_j-\mathbf r_i$,
o motor usa a aceleração

$$
\mathbf a_i = G\sum_{j\ne i} m_j
\frac{\mathbf r_j-\mathbf r_i}
{\left(\|\mathbf r_j-\mathbf r_i\|^2+\epsilon^2\right)^{3/2}}.
$$

O potencial usado no diagnóstico é coerente com a mesma suavização:

$$
U=-\sum_{i<j}\frac{Gm_im_j}
{\sqrt{\|\mathbf r_j-\mathbf r_i\|^2+\epsilon^2}}.
$$

Cada passo de **Velocity Verlet** calcula acelerações nas posições antiga e
nova. O custo é **O(N²)** em tempo por passo e **O(N)** em memória adicional.
Energia, momento linear e momento angular ajudam a avaliar a qualidade da
simulação; não se deve esperar energia exatamente constante a cada passo.

## Arquitetura

```text
src/OrbitalSim.Cli/                    JSON, comandos, CSV e benchmark
src/OrbitalSim.Application/            execução e amostragem
src/OrbitalSim.Domain/                 cenário, corpos e validação
src/OrbitalSim.Infrastructure.Fortran/ P/Invoke e tradução de erros
native/src/                           forças, Verlet, diagnósticos e ABI C
native/include/orbitalsim.h           contrato da biblioteca nativa
tests/native/                          testes Fortran
tests/OrbitalSim.IntegrationTests/     testes .NET e interoperabilidade
examples/                              cenários prontos
benchmarks/                            metodologia do benchmark
```

A CLI usa `LibraryImport` para chamar `os_step` e `os_diagnostics` da DLL
Fortran. O [cabeçalho C](native/include/orbitalsim.h) descreve a ABI: `mass`
contém `N` valores `double`; `pos` e `vel` contêm `3N` valores contíguos na
ordem `x, y, z` de cada corpo. `os_step` só altera os buffers quando retorna
sucesso. A interface retorna códigos de erro para entrada inválida, corpos
coincidentes sem suavização, resultado não finito ou falha de alocação.

## Testes e benchmark

O comando `build-all.ps1` executa os testes Fortran e os testes de integração
.NET. Para reconstruir somente a parte nativa:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\build-tdm.ps1
```

Os testes cobrem órbita circular de dois corpos, convergência, conservação,
movimento de um corpo, separação zero, preservação dos buffers em erro e chamada
da DLL pelo .NET.

Para medir o desempenho do caminho .NET → Fortran:

```powershell
dotnet run --project src\OrbitalSim.Cli -c Release --no-build -- benchmark --bodies 2,100,1000 --steps 100 --repeats 5 --batch 10
```

O comando imprime tempo, passos por segundo, interações por segundo, alocações
gerenciadas e deriva relativa de energia. Use `--out caminho.csv` para salvar
os resultados. Veja [a metodologia](benchmarks/README.md) antes de comparar
máquinas ou versões.

## Build alternativo com CMake

Com CMake 3.20+, Ninja e um compilador Fortran compatível disponíveis:

```sh
cmake -S . -B build -G Ninja -DCMAKE_BUILD_TYPE=Release
cmake --build build
ctest --test-dir build --output-on-failure
dotnet restore OrbitalSim.sln -m:1 -p:NuGetAudit=false
dotnet build OrbitalSim.sln -c Release --no-restore -m:1
dotnet run --project tests/OrbitalSim.IntegrationTests -c Release --no-build
```

No Windows, o [MSYS2 UCRT64](https://www.msys2.org/) é uma opção para instalar
GNU Fortran, CMake e Ninja. O script `build-all.ps1` é o caminho testado neste
projeto com TDM-GCC.

## Limites atuais

O simulador usa corpos pontuais, passo fixo e cálculo direto entre pares. Não
implementa colisões ou fusões, passo adaptativo, paralelismo, aproximações para
grandes valores de N, API HTTP nem interface gráfica. Avalie as unidades,
condições iniciais, suavização e deriva dos diagnósticos antes de usar os
resultados em um estudo.

## Licença

Distribuído sob a [licença MIT](LICENSE).
