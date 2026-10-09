# OrbitalSim

Simulador gravitacional **N-body** com motor numérico em Fortran moderna,
API e aplicação de linha de comando em **.NET 10**, e interface **React**.
O motor calcula a atração entre todos os pares de corpos e integra as órbitas
com Velocity Verlet. A aplicação
lê cenários em JSON e gera trajetórias e diagnósticos em arquivos simples de
analisar. A interface permite configurar cenários, executar simulações e
explorar as órbitas no navegador.

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

Em **Simulações prontas**, busque ou filtre um dos 26 cenários e clique em
**Visualizar** para executar e abrir a trajetória; **Editar dados** leva o
cenário ao formulário. Em **Criar cenário**, preencha os campos de gravidade,
suavização, passo de tempo, número de passos, intervalo de amostragem e os dados
de cada corpo: nome, massa, posição XYZ e velocidade XYZ. Adicione ou remova
corpos, importe ou exporte o cenário em JSON e clique em **Executar simulação**.
Os campos numéricos aceitam ponto ou vírgula como separador decimal.
Em **Explorar resultados**, use **Reproduzir**, a linha do tempo e o seletor de
velocidade. Arraste a cena para girar, use a roda do mouse para aproximar,
selecione um corpo para acompanhá-lo e escolha **Vista XY** ou **Enquadrar**.
**Importar CSV** abre `trajectory.csv` e, opcionalmente, `diagnostics.csv` de
uma execução anterior. O formulário envia os dados somente à API local.

### Galeria de simulações

| Grupo | Cenários disponíveis |
| --- | --- |
| Órbitas | Terra e satélite; órbita baixa; órbita alta; órbita polar; Sol e Terra; prógrado e retrógrado; planos inclinados; ressonância 2:1. |
| Coleções | Planeta e duas luas; quatro órbitas concêntricas; companheiros troianos; anel de oito; anel inclinado; nuvem de 24 corpos; sistemas de três e de seis planetas. |
| Experimentos | Elipse suave; elipse acentuada; cometa didático; quase escape; trajetória de escape. |
| Múltiplos | Estrelas binárias iguais; binárias desiguais; planeta circumbinário; dois planetas circumbinários; sistema triplo hierárquico. |

Todos usam unidades SI. Terra–satélite e Sol–Terra são aproximações; os demais
são sistemas didáticos idealizados, não efemérides ou previsões astronômicas.

A API limita cada execução web a 32 corpos, 20.000 passos e 1.001 amostras
para manter a resposta interativa. A CLI permite cenários maiores e exporta
os resultados para arquivos.

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
src/OrbitalSim.Cli/                    leitura de JSON, comandos, CSV e benchmark
src/OrbitalSim.Api/                    HTTP, limites interativos e interface compilada
src/OrbitalSim.Application/DTOs/       contrato de cenário e resultados
src/OrbitalSim.Application/Interfaces/ porta do motor numérico
src/OrbitalSim.Application/UseCases/   execução e amostragem
src/OrbitalSim.Domain/                 cenário, corpos e validação
src/OrbitalSim.Infrastructure.Fortran/ P/Invoke e tradução de erros
native/src/                           forças, Verlet, diagnósticos e ABI C
native/include/orbitalsim.h           contrato da biblioteca nativa
tests/native/                          testes Fortran
tests/OrbitalSim.IntegrationTests/     testes .NET e interoperabilidade
examples/                              cenários prontos
benchmarks/                            metodologia do benchmark
web/src/ScenarioEditor.jsx             entrada de dados e importação de cenários
web/src/Diagnostics.jsx                diagnósticos da trajetória
web/src/OrbitCanvas.jsx                cena 3D, câmera, trajetórias e escala
web/src/Timeline.jsx                   linha do tempo, reprodução e atalhos
web/src/BodyList.jsx                   seleção do corpo acompanhado
web/src/usePlayback.js                 reprodução das amostras por quadro
web/src/useEngineStatus.js             estado da API via /api/health
web/src/ErrorBoundary.jsx              falhas de renderização sem derrubar a interface
web/src/App.jsx                        composição e estado da interface React
web/style.css                          tokens de design e estilos da interface
```

Domain não referencia as camadas externas. Application contém o caso de uso
`RunSimulationUseCase`, o contrato `IOrbitEngine` e a conversão compartilhada
do cenário JSON; Infrastructure.Fortran implementa a porta. API e CLI fazem a
composição com `AddApplication` e `AddFortranInfrastructure`. A API aplica os
limites próprios da execução interativa antes de chamar o caso de uso; a CLI
continua aceitando cenários maiores. Versões de pacotes NuGet ficam em
`Directory.Packages.props`.

A CLI e a API usam `LibraryImport` para chamar `os_step` e `os_diagnostics` da DLL
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

Para testar a validação do formulário e o leitor de CSV, com Node.js 22.12 ou
superior:

```powershell
npm ci --prefix web
npm test --prefix web
npm run build --prefix web
powershell -ExecutionPolicy Bypass -File .\scripts\smoke-api.ps1
node scripts/verify-presets.mjs
```

`verify-presets.mjs` requer a API local em execução e verifica os 26 cenários,
as amostras e os resultados numéricos finitos.

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

O simulador usa corpos pontuais, passo fixo e cálculo direto entre pares. Não
implementa colisões ou fusões, passo adaptativo, paralelismo, aproximações para
grandes valores de N nem execução distribuída. A API web executa cenários
locais e devolve amostras em JSON; a CLI exporta arquivos CSV. Avalie as
unidades, condições iniciais, suavização e deriva dos diagnósticos antes de usar os
resultados em um estudo.

## Licença

Distribuído sob a [licença MIT](LICENSE).
