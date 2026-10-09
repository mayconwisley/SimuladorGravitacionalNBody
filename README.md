# OrbitalSim

Simulador gravitacional **N-body** com motor numérico em Fortran moderna,
API e aplicação de linha de comando em **.NET 10**, e interface **React**.
O motor calcula a atração entre todos os pares de corpos com massa e integra as
órbitas com Velocity Verlet, Yoshida de 4ª ordem ou Runge-Kutta 4. Também
simula partículas de teste sem massa, achatamento (J2), arrasto atmosférico,
correção relativística (1PN), colisões com fusão, manobras e tempo reverso, e
calcula elementos orbitais e eventos (periastro, apoastro, escape e colisão).
A aplicação lê cenários em JSON e gera trajetórias e diagnósticos em arquivos
simples de analisar; a interface permite configurar cenários, executar
simulações por streaming e explorar as órbitas no navegador.

O projeto inclui testes nativos, de integração e da interface, além de um
comando de benchmark. A API executa cenários pela mesma camada de aplicação
usada pela CLI; o motor Fortran continua responsável pelos cálculos.

## Início rápido no Windows

Pré-requisitos:

- .NET SDK 10;
- GNU Fortran do TDM-GCC em `C:\Programas\TDM-GCC-64\bin\gfortran.exe`;
- Node.js 22.12 ou superior para compilar a interface.

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

### Abrir a interface web

Na raiz do projeto, um comando compila e testa o motor, a API e a interface e
inicia o servidor local:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\start-web.ps1
```

Abra [http://127.0.0.1:5080](http://127.0.0.1:5080) no navegador. O servidor
escuta somente no computador local. Use `-Port 5090` para escolher outra porta
e encerre com `Ctrl+C`. Encerre a instância em execução antes de recompilar no
Windows, pois a DLL nativa fica em uso pelo servidor.

Cada aba tem um endereço próprio (`/`, `/editor`, `/resultados`); recarregar a
página mantém a aba, o rascunho do editor e recalcula a última simulação.

- **Simulações**: busque ou filtre os 36 cenários e clique em **Visualizar**
  para executar, ou em **Editar** para levar o cenário ao formulário.
- **Criar cenário**: escolha o integrador e os parâmetros numéricos (Δt
  negativo integra para trás no tempo); defina cada corpo por vetores XYZ ou por
  **elementos orbitais** em torno de um corpo listado antes; em **Física
  adicional**, ligue J2, atmosfera, relatividade e colisões; adicione **grupos
  de partículas** (anéis e discos) e **manobras** programadas. O resumo valida
  o cenário enquanto você edita e mostra o custo estimado. Importe ou exporte o
  cenário em JSON. Os campos aceitam ponto ou vírgula decimal.
- **Resultados**: as amostras chegam por streaming e já podem ser reproduzidas
  durante o cálculo (**Cancelar** interrompe). Use a linha do tempo, os
  marcadores de eventos, a repetição automática e as velocidades. Arraste a cena
  para girar, role para aproximar, escolha as vistas 3D/XY/XZ e o referencial
  **Inercial** ou **Girante** (gira com os dois corpos mais massivos e mostra
  pontos de Lagrange e órbitas em ferradura). Selecione um corpo para ver seus
  elementos orbitais e, no **sandbox**, aplicar um impulso (prógrado, radial,
  normal) ou arrastá-lo para uma nova posição; o motor recalcula a partir daquele
  instante. **Voltar no tempo** integra para trás a partir do instante atual e
  mede quanto o sistema volta ao estado inicial. Os diagnósticos mostram energias
  cinética e potencial, momentos e a deriva de energia; **Comparar integradores**
  sobrepõe Verlet, Yoshida e RK4 no mesmo cenário. Se o passo for grande para o
  encontro mais próximo entre corpos com massa, um aviso oferece o Δt sugerido
  pelo motor.
- **Importar CSV** abre `trajectory.csv` e, opcionalmente, `diagnostics.csv`,
  `events.csv` e `particles.csv` de uma execução da CLI. O formulário envia os
  dados somente à API local.

### Galeria de simulações

| Grupo | Cenários disponíveis |
| --- | --- |
| Órbitas | Terra e satélite; órbita baixa; órbita alta; órbita polar; Sol e Terra; prógrado e retrógrado; planos inclinados; ressonância 2:1. |
| Coleções | Planeta e duas luas; quatro órbitas concêntricas; companheiros troianos; anel de oito; anel inclinado; nuvem de 24 corpos; sistemas de três e de seis planetas. |
| Experimentos | Elipse suave; elipse acentuada; cometa didático; quase escape; trajetória de escape; transferência de Hohmann. |
| Múltiplos | Estrelas binárias iguais; binárias desiguais; planeta circumbinário; dois planetas circumbinários; sistema triplo hierárquico; órbita em ferradura. |
| Física | Precessão por achatamento (J2); decaimento por arrasto; precessão relativística; acreção de planetesimais; comparar integradores. |
| Partículas | Anel e lua pastora; cinturão e Júpiter; colisão de galáxias. |

Todos usam unidades SI. Terra–satélite, Sol–Terra e a precessão por J2 usam
valores aproximados; a atmosfera, a velocidade da luz reduzida e as massas
exageradas são escolhas didáticas indicadas na descrição de cada cenário. Os
demais são sistemas idealizados, não efemérides ou previsões astronômicas.

A API limita cada execução web a 32 corpos, 2.000 partículas em até 8 grupos,
100 manobras, 20.000 passos, 1.001 amostras, 400.000 posições de partículas
(amostras × partículas) e cerca de 6 × 10⁸ interações de pares. A CLI aceita
cenários maiores e exporta os resultados para arquivos.

## Resultados da simulação

| Arquivo | Conteúdo |
| --- | --- |
| `trajectory.csv` | Uma linha por corpo nomeado e amostra: passo, tempo, nome, massa, posição, velocidade, raio e se está ativo (0 após ser absorvido numa colisão). |
| `diagnostics.csv` | Uma linha por amostra: energia total, momento linear, momento angular, energia cinética e potencial. |
| `events.csv` | Colisões, periastros, apoastros, escapes e manobras com passo, tempo, corpos envolvidos e distância. |
| `particles.csv` | Só com grupos de partículas: posição de cada partícula ativa por amostra. |
| `summary.json` | Corpos, partículas, integrador, passos, amostras, tempo final, energia inicial e final, deriva, eventos, colisões, menor separação e Δt sugerido. |

A primeira amostra representa o estado inicial. Depois, o programa registra o
estado a cada `sampleEverySteps` passos e sempre inclui o último passo, mesmo
quando o intervalo final é menor. A exportação é sequencial: a memória usada
para amostras não cresce com a duração da simulação. As colunas novas vêm
depois das originais, então leitores antigos continuam funcionando.

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
| `timeStepSeconds` | Duração fixa de cada passo, em s; não pode ser zero (negativo integra para trás). |
| `steps` | Número total de passos; inteiro positivo. |
| `sampleEverySteps` | Intervalo de amostragem; inteiro positivo. |
| `integrator` | Opcional: `verlet` (padrão), `yoshida4` ou `rk4`. |
| `bodies` | Corpos com nome único e massa em kg (0 = partícula de teste, ao menos um com massa positiva). |

Cada corpo usa `positionMeters` e `velocityMetersPerSecond` (vetores `[x, y, z]`
em m e m/s) **ou** uma órbita em torno de um corpo listado antes:

```json
{ "name": "Lua", "massKg": 7.35e22,
  "orbit": { "around": "Terra", "semiMajorAxisMeters": 3.844e8, "eccentricity": 0.055,
             "inclinationDegrees": 5.1, "ascendingNodeDegrees": 0,
             "argumentOfPeriapsisDegrees": 0, "trueAnomalyDegrees": 0 },
  "radiusMeters": 1.737e6, "dragAreaPerMassSquareMetersPerKg": 0 }
```

Elipses usam `a > 0` e `0 ≤ e < 1`; hipérboles, `a < 0` e `e > 1`. O raio
(m) só é usado em colisões e o coeficiente balístico `Cd·A/m` (m²/kg), no
arrasto. As seções opcionais, todas em SI:

```json
"physics": { "centralBody": "Terra", "j2": 1.08263e-3, "centralRadiusMeters": 6.378137e6,
             "atmosphereDensityKgPerCubicMeter": 1.225, "atmosphereScaleHeightMeters": 8500,
             "lightSpeedMetersPerSecond": 0, "collisions": false },
"particleGroups": [ { "name": "Anel", "around": "Saturno", "count": 1000,
                      "innerRadiusMeters": 1.0e8, "outerRadiusMeters": 1.4e8,
                      "eccentricity": 0, "inclinationDegrees": 0, "ascendingNodeDegrees": 0 } ],
"maneuvers": [ { "body": "Satélite", "step": 583, "deltaVelocityMetersPerSecond": [0, 2336.8, 0],
                 "deltaPositionMeters": [0, 0, 0] } ]
```

Todos os números devem ser finitos. Com suavização zero, corpos na mesma posição
causam erro. Para melhorar a precisão, reduza o passo de tempo, troque o
integrador e compare a trajetória e os diagnósticos.

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

- **Integradores.** Velocity Verlet (2ª ordem, simplético, 1 avaliação de força
  por passo), Yoshida (composição de três subpassos de Verlet: 4ª ordem,
  simplético, 3 avaliações) e Runge-Kutta 4 (4ª ordem, não simplético, 4
  avaliações). Nos simpléticos a energia oscila sem derivar; no RK4 ela deriva.
  Verlet e Yoshida são reversíveis: com Δt negativo, voltam ao estado inicial
  até o arredondamento. O custo é **O(M² + M·P)** por avaliação, com M corpos
  com massa e P partículas de teste.
- **J2.** Achatamento do corpo central em torno do eixo z inercial, com o
  termo correspondente no potencial (a energia continua conservada).
- **Arrasto.** $\mathbf a = -\tfrac12\rho(h)\,(C_dA/m)\,|\mathbf v|\,\mathbf v$
  com $\rho(h)=\rho_0 e^{-h/H}$ e velocidade relativa ao corpo central.
- **1PN.** Correção de Schwarzschild (gauge harmônico) em torno do corpo central;
  o periastro avança $6\pi GM/(c^2a(1-e^2))$ por órbita em primeira ordem.
- **Reações.** J2, arrasto e 1PN atuam com a reação no corpo central, conservando
  o momento linear. Arrasto e 1PN dependem da velocidade, e os integradores
  deixam de ser simpléticos com eles.
- **Colisões.** Corpos cujos raios se tocam se fundem: o mais massivo sobrevive
  com a soma das massas, o centro de massa, a velocidade do centro de massa e o
  raio que conserva o volume; partículas são absorvidas.
- **Eventos e Δt sugerido.** O motor relata periastro e apoastro (órbitas com
  e ≥ 0,01), escape e colisões em relação ao corpo de referência (o central ou o
  mais massivo), além da menor separação e de um Δt sugerido de
  $2\pi\sqrt{r^3/G(m_i+m_j)}/200$ no encontro mais próximo, com e sem partículas.

Energia, momento linear e momento angular ajudam a avaliar a qualidade da
simulação; não se deve esperar energia exatamente constante a cada passo.

## Arquitetura

```text
src/OrbitalSim.Cli/                    leitura de JSON, comandos, CSV e benchmark
src/OrbitalSim.Api/                    HTTP, streaming NDJSON, limites interativos e interface compilada
src/OrbitalSim.Application/DTOs/       contrato de cenário, estado do motor e resultados
src/OrbitalSim.Application/Interfaces/ porta do motor numérico
src/OrbitalSim.Application/UseCases/   montagem do cenário (órbitas, partículas), execução, manobras e amostragem
src/OrbitalSim.Domain/                 cenário, corpos, física opcional, manobras e validação
src/OrbitalSim.Infrastructure.Fortran/ P/Invoke, structs da ABI e tradução de erros
native/src/orbital_types.f90           structs interoperáveis da ABI
native/src/orbital_forces.f90          gravidade, partículas, J2, arrasto, 1PN e validação
native/src/orbital_integrator.f90      Verlet, Yoshida, RK4, colisões e eventos
native/src/orbital_diagnostics.f90     energias, momento linear e angular
native/src/orbital_elements.f90        conversões entre estado e elementos orbitais
native/src/orbital_c_api.f90           funções exportadas
native/include/orbitalsim.h           contrato da biblioteca nativa
tests/native/                          testes Fortran
tests/OrbitalSim.IntegrationTests/     testes .NET e interoperabilidade
examples/                              cenários prontos
benchmarks/                            metodologia do benchmark
web/src/ScenarioEditor.jsx             orquestração do editor e resumo validado
web/src/BodyCard.jsx                   corpo por vetores ou elementos orbitais
web/src/PhysicsSection.jsx             J2, atmosfera, relatividade e colisões
web/src/ParticleGroupsSection.jsx      grupos de partículas
web/src/ManeuversSection.jsx           manobras programadas
web/src/fields.jsx                     campos de formulário compartilhados
web/src/Diagnostics.jsx                diagnósticos e comparação de integradores
web/src/EventsPanel.jsx                lista de eventos
web/src/OrbitPanel.jsx                 elementos do corpo selecionado
web/src/ImpulseForm.jsx                impulso do sandbox
web/src/OrbitCanvas.jsx                cena 3D, referencial girante, partículas e arraste
web/src/Timeline.jsx                   linha do tempo, marcadores, reprodução e atalhos
web/src/BodyList.jsx                   corpos e grupos de partículas
web/src/scenario.mjs                   mapeamento e validação do cenário (limites da API)
web/src/dataset.mjs                    amostras transmitidas, partículas e séries
web/src/simulationClient.mjs           chamadas à API e leitura do NDJSON
web/src/sandbox.mjs                    base orbital do impulso e manobras
web/src/csvImport.mjs                  importação dos CSV da CLI
web/src/usePlayback.js                 reprodução das amostras por quadro
web/src/useEngineStatus.js             estado da API via /api/health
web/src/ErrorBoundary.jsx              falhas de renderização sem derrubar a interface
web/src/routes.mjs                     rotas das abas (/, /editor, /resultados)
web/src/session.mjs                    rascunho e última execução mantidos no F5
web/src/App.jsx                        composição e estado da interface React
web/style.css                          tokens de design e estilos da interface
```

Domain não referencia as camadas externas. Application contém os casos de uso
`BuildScenarioUseCase` (converte o JSON, resolvendo órbitas e partículas pelo
motor) e `RunSimulationUseCase` (amostragem, manobras e eventos), o contrato
`IOrbitEngine` e os DTOs; Infrastructure.Fortran implementa a porta. API e CLI
fazem a composição com `AddApplication` e `AddFortranInfrastructure`. A API
aplica os limites próprios da execução interativa antes de chamar o caso de uso;
a CLI continua aceitando cenários maiores. Versões de pacotes NuGet ficam em
`Directory.Packages.props`.

A API expõe `GET /api/health`, `POST /api/simulations` (resposta JSON completa)
e `POST /api/simulations/stream` (NDJSON: uma linha `start`, uma linha `sample`
por amostra assim que é calculada e `end` ou `error`). As posições das
partículas vão em float32 little-endian codificado em base64.

O [cabeçalho C](native/include/orbitalsim.h) descreve a ABI, chamada pelo .NET
com `LibraryImport`: `os_advance` (integrador, física, colisões, eventos e
relatório; reaproveita a aceleração entre chamadas), `os_energy`,
`os_orbital_elements` e `os_elements_to_state`, além de `os_step` e
`os_diagnostics`, mantidas com o contrato original. `mass` contém `N` valores
`double`; `pos`, `vel` e `acc` contêm `3N` valores contíguos na ordem `x, y, z`
de cada corpo. Nenhuma função altera os buffers do chamador quando retorna erro.
Os códigos indicam entrada inválida, corpos coincidentes sem suavização,
resultado não finito ou falha de alocação.

## Testes e benchmark

O comando `build-all.ps1` executa os testes Fortran e os testes de integração
.NET. Para reconstruir somente a parte nativa:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\build-tdm.ps1
```

Os testes nativos cobrem órbita circular de dois corpos, ordem de convergência
dos três integradores (4 e 16), energia limitada nos simpléticos e deriva
secular no RK4, cache de aceleração, partículas de teste, ida e volta dos
elementos orbitais, regressão nodal por J2, decaimento por arrasto, avanço do
periastro por 1PN, fusões com conservação do momento, eventos, reversibilidade,
relatório, validação e preservação dos buffers em erro. Os testes de integração
cobrem a interoperabilidade (incluindo o layout das structs), a montagem do
cenário, manobras, colisões e tempo reverso.

Para testar o formulário, o leitor de CSV e a interface, com Node.js 22.12 ou
superior:

```powershell
npm ci --prefix web
npm test --prefix web
npm run build --prefix web
powershell -ExecutionPolicy Bypass -File .\scripts\smoke-api.ps1
node scripts/verify-presets.mjs
```

`verify-presets.mjs` requer a API local em execução e verifica os 36 cenários,
as amostras, as partículas e os resultados numéricos finitos; a maior deriva de
energia é calculada só entre os cenários conservativos.

O fluxo em [`.github/workflows/ci.yml`](.github/workflows/ci.yml) executa os
testes nativos, de integração, do formulário, do leitor CSV e da API, além de
gerar os arquivos do cenário de exemplo em Linux. Os resultados locais em
`build/`, `output/`, `web/dist/` e `benchmarks/results.csv` são ignorados pelo
Git e podem ser recriados pelos comandos acima.

Durante o desenvolvimento da interface, mantenha a API e o Vite abertos em
terminais separados, após compilar o motor:

```powershell
dotnet run --project src/OrbitalSim.Api -c Release --no-build --no-launch-profile --urls http://127.0.0.1:5080
npm run dev --prefix web
```

Abra `http://127.0.0.1:5173`; o Vite encaminha chamadas `/api` à API local.
O comando `start-web.ps1` usa a versão compilada da interface e exige apenas
um servidor.

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
cmake -S . -B build/cmake -G Ninja -DCMAKE_BUILD_TYPE=Release
cmake --build build/cmake
ctest --test-dir build/cmake --output-on-failure
dotnet restore OrbitalSim.sln -m:1 -p:NuGetAudit=false
dotnet build OrbitalSim.sln -c Release --no-restore -m:1
dotnet run --project tests/OrbitalSim.IntegrationTests -c Release --no-build
```

No Windows, o [MSYS2 UCRT64](https://www.msys2.org/) é uma opção para instalar
GNU Fortran, CMake e Ninja. O script `build-all.ps1` é o caminho testado neste
projeto com TDM-GCC.

## Limites atuais

O simulador usa passo fixo e cálculo direto entre pares de corpos com massa.
Não implementa passo adaptativo, paralelismo, aproximações para grandes valores
de N (como Barnes-Hut) nem execução distribuída. O J2 supõe o eixo de rotação
do corpo central alinhado ao eixo z inercial; a atmosfera é exponencial e não
gira com o corpo central; a correção 1PN considera só o corpo central. A API web
executa cenários locais e devolve amostras em JSON; a CLI exporta arquivos CSV.
Avalie as unidades, condições iniciais, suavização e deriva dos diagnósticos
antes de usar os resultados em um estudo.

## Licença

Distribuído sob a [licença MIT](LICENSE).
