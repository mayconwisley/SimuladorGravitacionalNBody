<p align="center"><img src="web/public/favicon.svg" width="96" height="96" alt="Logo do OrbitalSim: corpo central e órbita inclinada"></p>

# OrbitalSim

**Simulador gravitacional N-body com motor Fortran, API .NET e interface React.**

[![Fortran](https://img.shields.io/badge/Fortran-2008-734F96?logo=fortran&logoColor=white)](native/src/)
[![.NET](https://img.shields.io/badge/.NET-10-512BD4?logo=dotnet&logoColor=white)](OrbitalSim.sln)
[![React](https://img.shields.io/badge/React-19-149ECA?logo=react&logoColor=white)](web/package.json)
[![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white)](web/package.json)
[![Node.js](https://img.shields.io/badge/Node.js-%E2%89%A522.12-5FA04E?logo=nodedotjs&logoColor=white)](web/package.json)
[![CMake](https://img.shields.io/badge/CMake-%E2%89%A53.20-064F8C?logo=cmake&logoColor=white)](CMakeLists.txt)
[![CI](https://github.com/mayconwisley/SimuladorGravitacionalNBody/actions/workflows/ci.yml/badge.svg)](https://github.com/mayconwisley/SimuladorGravitacionalNBody/actions/workflows/ci.yml)
[![Licença MIT](https://img.shields.io/badge/Licen%C3%A7a-MIT-2E8B57)](LICENSE)

## Visão geral

O OrbitalSim combina um motor numérico em Fortran 2008, uma API e uma CLI em
.NET 10 e uma interface React 19 com Vite 8. A arquitetura mantém os cálculos
físicos no motor nativo, expostos à aplicação por uma ABI C estável.

**Nesta página:** [Início rápido](#início-rápido-no-windows) ·
[Interface web](#abrir-a-interface-web) · [Visual Studio](#iniciar-pelo-visual-studio) ·
[Cenários](#criar-um-cenário) · [Método numérico](#método-numérico) ·
[Arquitetura](#arquitetura) · [Testes](#testes-e-benchmark)

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

Na raiz do repositório, compile o motor e a solução .NET e execute os testes
nativos e de integração:

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

Na raiz do projeto, este comando compila e testa o motor, a API e a interface,
depois inicia o servidor local:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\start-web.ps1
```

Abra [http://127.0.0.1:5080](http://127.0.0.1:5080) no navegador. O servidor
escuta somente no computador local. Use `-Port 5090` para escolher outra porta
e encerre com `Ctrl+C`. Encerre a instância em execução antes de recompilar no
Windows, pois a DLL nativa fica em uso pelo servidor.

### Iniciar pelo Visual Studio

Após uma compilação nativa e um build do frontend, selecione
`OrbitalSim.Api` como projeto de inicialização e execute o perfil `http` pelo
**Start** do Visual Studio. A API serve os arquivos de `web/dist` em
[http://127.0.0.1:5080](http://127.0.0.1:5080). O perfil atual tem
`launchBrowser: false`: abra o endereço manualmente. Para preparar essa forma
de execução em um clone novo:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\build-all.ps1
npm ci --prefix web
npm run build --prefix web
```

Ao alterar o frontend, repita `npm run build --prefix web` para atualizar a
versão servida pela API. Durante o desenvolvimento com recarga automática,
use o [servidor do Vite](#desenvolvimento-da-interface).

A DLL `orbitalsim.dll` é produzida em `build/tdm-gcc/` e copiada para a saída
da API pelo projeto .NET. Por ser gerada, não é versionada. A pasta `out/`,
quando criada pelo suporte a CMake do Visual Studio, também contém arquivos
locais de configuração e build; ela não faz parte do código-fonte nem é usada
pelos scripts de build documentados aqui.

Cada aba tem um endereço próprio (`/`, `/editor`, `/resultados`, `/manual`); recarregar a
página mantém a aba, o rascunho do editor e recalcula a última simulação.

- **Simulações**: busque ou filtre os 125 cenários e clique em **Visualizar**
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
  pontos de Lagrange e órbitas em ferradura). A cena é desenhada como seria vista
  no espaço: planetas e luas conhecidos aparecem no tamanho real quando a massa do
  cenário é a real (a Terra de 6.371 km sob o satélite a 630 km), com superfície,
  rotação, fases iluminadas pela estrela mais brilhante, atmosfera, luzes das
  cidades no lado noturno e os anéis de Saturno; estrelas têm a cor da sua
  temperatura, cometas mostram caudas de íons e de poeira apontando para longe da
  estrela, e o céu de fundo (com a Via Láctea) gira com a câmera. Corpos pequenos
  demais para a escala mantêm um marcador mínimo, e a grade de referência pode ser
  ligada na barra da cena. Selecione um corpo para ver seus
  elementos orbitais e, no **sandbox**, aplicar um impulso (prógrado, radial,
  normal) ou arrastá-lo para uma nova posição; o motor recalcula a partir daquele
  instante. **Voltar no tempo** integra para trás a partir do instante atual e
  mede quanto o sistema volta ao estado inicial. Os diagnósticos mostram energias
  cinética e potencial, momentos e a deriva de energia; **Comparar integradores**
  sobrepõe Verlet, Yoshida e RK4 no mesmo cenário. Se o passo for grande para o
  encontro mais próximo entre corpos com massa, um aviso oferece o Δt sugerido
  pelo motor.
- **Importar CSV** abre `trajectory.csv` e, opcionalmente, `diagnostics.csv`,
  `events.csv` e `particles.csv` de uma execução da CLI. Os arquivos são lidos
  no navegador e exibidos em Resultados; é preciso selecioná-los novamente após
  recarregar a página.
- **Manual** (`/manual`): guia para quem usa a aplicação no navegador, com
  galeria, criação de cenários, formatos JSON e CSV, controles dos resultados,
  precisão, limites e solução de problemas.

### Galeria de simulações

A galeria tem 125 cenários, mostrados 25 por página. Busca, categoria e página
ficam na URL (`/?categoria=Física&busca=j2&pagina=2`), então F5 e o botão
voltar mantêm a posição.

| Grupo | Cenários disponíveis |
| --- | --- |
| Órbitas | Terra e satélite; órbitas baixa, alta e polar; Sol e Terra; prógrado e retrógrado; planos inclinados; ressonância 2:1; satélites geoestacionários; constelação GPS; constelação em órbita baixa; sondas em órbita lunar. |
| Coleções | Marte e suas duas luas; quatro órbitas concêntricas; companheiros troianos; anel de oito; anel inclinado; nuvem de 24 corpos; sistemas de três e de seis planetas (Mercúrio a Saturno). |
| Experimentos | Elipses suave e acentuada; cometa didático; quase escape; escape; Hohmann; encontro orbital; bi-elíptica contra Hohmann; mudança de plano; estilingue gravitacional; reentrada controlada; rumo à Lua; efeito Oberth; missão DART; mesmo semi-eixo, mesmo período; queda radial; esfera de Hill; pontos de Lagrange Sol–Terra. |
| Múltiplos | Binárias iguais e desiguais; um e dois planetas circumbinários; triplo hierárquico; órbita em ferradura; coreografia em oito; triângulo de Lagrange; solução colinear de Euler; problema pitagórico; aglomerado de Plummer; colapso frio; estrela intrusa; sistema quádruplo; limite de estabilidade circumbinário; Alfa Centauri A e B; Castor (sêxtupla); coreografia borboleta; problema de Sitnikov; limite de Routh; Kozai–Lidov; mecanismo de Hills. |
| Física | J2; arrasto; precessão relativística; planetesimais; comparar integradores; avanço do perigeu (J2); circularização por arrasto; S2 e Sgr A*; impacto de Theia; amaciamento; aerocaptura em Marte; Shoemaker-Levy 9; pulsar binário Hulse–Taylor. |
| Partículas | Anel de Saturno e Mimas; cinturão e Júpiter; colisão de galáxias; aglomerado desfeito por maré; nuvem coorbital de Júpiter; disco truncado; anéis inclinados com J2; Roda de Carro; cinturão de Kuiper; uma lua vira anel (limite de Roche); Via Láctea e Andrômeda; corrente de Sagitário. |
| Sistema Solar | Planetas rochosos; planetas gigantes; Sistema Solar completo; Terra e Lua; Sol, Terra e Lua; luas galileanas, de Saturno, de Urano e de Netuno; Plutão e Caronte; Halley; ʻOumuamua; rosácea de Vênus; laços de Marte; Netuno–Plutão 3:2; Cruithne; troianos de Júpiter; Jano e Epimeteu; luas pastoras do anel F; lacunas de Kirkwood; oscilação do Sol; Planeta Nove. |
| Exoplanetas | TRAPPIST-1; Kepler-11; Kepler-90; Gliese 876; HR 8799; Proxima Centauri; 51 Pegasi b; HD 80606 b; HD 110067; planetas do pulsar PSR B1257+12; Kepler-9 e as variações nos trânsitos. |
| Missões | Apollo 13 (retorno livre); Voyager 2 (Grand Tour); Galileo (Vênus, Terra, Terra, Júpiter); janela para Marte de 2020; órbitas Molniya; Apophis em 2029; minilua temporária. |

Todos usam unidades SI. Os cenários de Sistema Solar e exoplanetas partem de
elementos orbitais médios (J2000, JPL) e massas publicadas, aproximados; onde
só se conhece m·sen i a órbita é tomada de perfil. A atmosfera didática, a
velocidade da luz reduzida, as massas exageradas e as posições ilustrativas
(troianos, Cruithne) estão indicadas na descrição de cada cenário. Os demais
são sistemas idealizados, não efemérides ou previsões astronômicas. Os módulos
ficam em `web/src/presets.mjs` (clássicos), `presetsSolarSystem.mjs`,
`presetsExoplanets.mjs`, `presetsLaboratory.mjs`, `presetsMissions.mjs` e
`presetsAdvanced.mjs`, com construtores comuns em `presetHelpers.mjs`; as
manobras dos experimentos são calculadas ali a partir das fórmulas de dois
corpos, de modo que seguem o passo de cada cenário.

Nas missões, os planetas partem dos elementos médios do JPL com suas taxas de
variação na data de lançamento. Os sobrevoos (Apollo 13, Voyager 2, Galileo,
Perseverance) foram mirados com o próprio motor: arcos de Lambert entre os
planetas dão a direção de saída de cada sobrevoo, e um tiro de Newton no plano B
ajusta o lançamento e as correções de rota. O resultado fica gravado como
estado inicial e manobras exatas, então a galeria reproduz a trajetória passo a
passo. Como as posições planetárias são aproximadas, as altitudes e datas dos
sobrevoos diferem um pouco das reais, e as correções de rota são maiores que as
da missão; cada descrição informa os valores obtidos.

A API limita cada execução web a 32 corpos, 2.000 partículas em até 8 grupos,
100 manobras, 3.000.000 de passos, 1.001 amostras, 400.000 posições de partículas
(amostras × partículas) e cerca de 6 × 10⁸ interações de pares. Com poucos corpos,
milhões de passos curtos custam pouco e permitem resolver sobrevoos rápidos ao
longo de missões de anos; é o limite de interações que mantém cada execução em
segundos. A CLI aceita cenários maiores e exporta os resultados para arquivos.

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
- **1PN.** Correção de Schwarzschild (gauge harmônico) da órbita relativa de cada
  corpo em torno do corpo central, com a massa total do par $M = M_c + m$ e
  repartida entre os dois na proporção das massas: o periastro avança
  $6\pi GM/(c^2a(1-e^2))$ por órbita em primeira ordem, inclusive para massas
  comparáveis, como no pulsar binário de Hulse–Taylor.
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
web/src/ScenarioSummary.jsx            resumo do cenário em execução na página de resultados
web/src/presetSummaries.mjs            resumos de 3 a 4 linhas de cada cenário da galeria
web/src/Manual.jsx                     manual de uso para o público da interface
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
web/src/bodyAppearance.mjs             aparência dos corpos: catálogo real e classificação
web/src/bodyRenderer.mjs               esferas iluminadas, estrelas, anéis, caudas e naves
web/src/planetTextures.mjs             superfícies procedurais geradas em fatias
web/src/skyRenderer.mjs                céu de fundo e Via Láctea
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
web/src/routes.mjs                     rotas das abas (/, /editor, /resultados, /manual)
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

`verify-presets.mjs` requer a API local em execução e verifica os 125 cenários,
as amostras, as partículas e os resultados numéricos finitos; a maior deriva de
energia é calculada só entre os cenários conservativos.

O fluxo em [`.github/workflows/ci.yml`](.github/workflows/ci.yml) executa os
testes nativos, de integração, do formulário, do leitor CSV e da API, além de
gerar os arquivos do cenário de exemplo em Linux. Os resultados locais em
`build/`, `output/`, `web/dist/` e `benchmarks/results.csv` são ignorados pelo
Git e podem ser recriados pelos comandos acima.

### Desenvolvimento da interface

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
