import { Link } from 'react-router';

const jsonExample = `{
  "gravity": 6.67430e-11,
  "softeningMeters": 0,
  "timeStepSeconds": 5,
  "steps": 1200,
  "sampleEverySteps": 20,
  "bodies": [
    {
      "name": "Terra",
      "massKg": 5.972e24,
      "positionMeters": [0, 0, 0],
      "velocityMetersPerSecond": [0, 0, 0]
    },
    {
      "name": "Satélite",
      "massKg": 1000,
      "positionMeters": [7000000, 0, 0],
      "velocityMetersPerSecond": [0, 7545.947, 0]
    }
  ]
}`;

const trajectoryExample = `step,time_s,body,mass_kg,x_m,y_m,z_m,vx_m_s,vy_m_s,vz_m_s,radius_m,active
0,0,Terra,5.972e24,0,0,0,0,0,0,6371000,1
0,0,Satélite,1000,7000000,0,0,0,7545.947,0,0,1
1,5,Terra,5.972e24,0,0,0,0,0,0,6371000,1
1,5,Satélite,1000,6999898,37729.735,0,-40.67,7545.84,0,0,1`;

const csvFiles = [
  { name: 'trajectory.csv', use: 'Obrigatório', columns: 'step, time_s, body, mass_kg, x_m, y_m, z_m, vx_m_s, vy_m_s, vz_m_s',
    header: 'step,time_s,body,mass_kg,x_m,y_m,z_m,vx_m_s,vy_m_s,vz_m_s,radius_m,active',
    detail: 'Uma linha por corpo em cada amostra. radius_m e active são colunas opcionais; active = 0 oculta um corpo absorvido em colisão.' },
  { name: 'diagnostics.csv', use: 'Opcional', columns: 'step, energy_j, px_kg_m_s, py_kg_m_s, pz_kg_m_s',
    header: 'step,time_s,energy_j,px_kg_m_s,py_kg_m_s,pz_kg_m_s,lx_kg_m2_s,ly_kg_m2_s,lz_kg_m2_s,kinetic_j,potential_j',
    detail: 'Adiciona energia e momento linear. Um arquivo completo também pode trazer time_s, momento angular, energia cinética e potencial.' },
  { name: 'events.csv', use: 'Opcional', columns: 'step, time_s, kind, body, other, distance_m',
    header: 'step,time_s,kind,body,other,distance_m',
    detail: 'Mostra colisões, periastros, apoastros, escapes e manobras. other e distance_m podem ficar vazios em eventos sem segundo corpo ou distância.' },
  { name: 'particles.csv', use: 'Opcional', columns: 'step, group, particle, x_m, y_m, z_m',
    header: 'step,time_s,group,particle,x_m,y_m,z_m',
    detail: 'Posições das partículas de grupos. O arquivo também pode incluir time_s; particle começa em 1 dentro de cada grupo.' }
];

function CodeExample({ label, children }) {
  return <div className="manual-code">
    <div className="manual-code-label">{label}</div>
    <pre><code>{children}</code></pre>
  </div>;
}

export default function Manual() {
  return <div className="manual-layout">
    <div className="page-heading manual-heading">
      <div><p className="eyebrow">Guia de uso</p><h1>Manual do OrbitalSim</h1>
        <p className="lead">Tudo o que você precisa para criar cenários, executar simulações e interpretar resultados diretamente no navegador.</p></div>
    </div>

    <nav className="manual-index" aria-label="Seções do manual">
      <a href="#primeiros-passos">Primeiros passos</a>
      <a href="#galeria">Simulações prontas</a>
      <a href="#editor">Criar cenário</a>
      <a href="#json">Importar JSON</a>
      <a href="#opcionais">Física e manobras</a>
      <a href="#csv">Importar CSV</a>
      <a href="#resultados">Ler resultados</a>
      <a href="#precisao">Precisão</a>
      <a href="#sessao">Sessão e limites</a>
      <a href="#ajuda">Problemas comuns</a>
    </nav>

    <section className="panel manual-section" id="primeiros-passos">
      <p className="eyebrow">01 · Comece aqui</p><h2>Da configuração à trajetória</h2>
      <ol className="manual-steps">
        <li><strong>Escolha um ponto de partida.</strong> Abra <Link to="/">Simulações</Link> para visualizar um cenário pronto ou <Link to="/editor">Criar cenário</Link> para editar corpos e parâmetros.</li>
        <li><strong>Configure a física.</strong> Defina massas, posições e velocidades em SI; ajuste o passo de tempo, a quantidade de passos e o intervalo de amostragem. O editor valida os campos e estima o custo antes da execução.</li>
        <li><strong>Execute e explore.</strong> Clique em <strong>Executar simulação</strong>. Em Resultados, use a linha do tempo, as vistas 3D/XY/XZ, a seleção de corpos, os eventos e os diagnósticos.</li>
      </ol>
      <div className="manual-note"><strong>Qual importação usar?</strong> JSON descreve as condições iniciais e abre um cenário editável. CSV contém amostras já calculadas e abre o visualizador; não permite recalcular nem usar as ações do sandbox.</div>
    </section>

    <section className="panel manual-section" id="galeria">
      <p className="eyebrow">02 · Escolher</p><h2>Explorar simulações prontas</h2>
      <p>Na aba <Link to="/">Simulações</Link>, use a busca e os filtros para encontrar exemplos de órbitas, transferências, sistemas de vários corpos, efeitos físicos e partículas. Cada cartão apresenta o objetivo do cenário e seus parâmetros principais.</p>
      <div className="manual-file-list">
        <article className="manual-file"><h3>Visualizar</h3><p>Executa o cenário pronto e abre Resultados. As amostras aparecem conforme são calculadas; você já pode observar a trajetória antes do fim.</p></article>
        <article className="manual-file"><h3>Editar</h3><p>Abre o mesmo cenário em Criar cenário. Altere massas, órbitas, duração ou física e execute sua versão. O modelo original da galeria continua disponível.</p></article>
      </div>
      <div className="manual-note">Os exemplos são educativos. Alguns usam valores aproximados ou efeitos exagerados para tornar o fenômeno visível; não representam previsões astronômicas.</div>
    </section>

    <section className="panel manual-section" id="editor">
      <p className="eyebrow">03 · Configurar</p><h2>Criar um cenário no editor</h2>
      <p>Na aba <Link to="/editor">Criar cenário</Link>, monte as condições iniciais e confira o resumo de validação. Os campos numéricos do formulário aceitam ponto ou vírgula decimal. Todos os valores físicos são em unidades SI, exceto ângulos, que são em graus.</p>
      <div className="manual-file-list">
        <article className="manual-file"><h3>Parâmetros numéricos</h3><p>Escolha Velocity Verlet, Yoshida ou RK4; defina a constante gravitacional, a suavização, o passo Δt em segundos, o número de passos e o intervalo entre amostras. Δt negativo integra para trás no tempo.</p></article>
        <article className="manual-file"><h3>Corpos</h3><p>Adicione ao menos um corpo com massa positiva. Cada corpo tem nome único, massa e estado inicial por posição/velocidade XYZ ou por elementos orbitais em torno de um corpo listado antes. Massa zero cria um corpo de teste.</p></article>
        <article className="manual-file"><h3>Física adicional</h3><p>Ative achatamento J2, atmosfera, relatividade ou colisões quando fizer sentido. Os botões de preenchimento rápido oferecem valores de referência para Terra, atmosfera e velocidade da luz.</p></article>
        <article className="manual-file"><h3>Partículas e manobras</h3><p>Grupos de partículas criam anéis ou discos sem massa. Manobras aplicam um impulso XYZ em um passo escolhido e podem incluir deslocamento instantâneo.</p></article>
      </div>
      <h3>Ordem recomendada</h3>
      <ol className="manual-steps">
        <li>Comece com um modelo da galeria ou crie um corpo central com massa positiva.</li>
        <li>Adicione os demais corpos. Para órbitas por elementos, coloque o corpo central antes do corpo orbitante.</li>
        <li>Escolha um Δt pequeno em comparação com o período orbital; aumente <code>sampleEverySteps</code> se o limite de amostras for atingido.</li>
        <li>Observe a validação no resumo e execute. Se aparecer uma sugestão de Δt menor, compare os diagnósticos antes de interpretar a trajetória.</li>
      </ol>
      <p>Você pode recolher cartões de corpos para organizar o formulário. O botão <strong>Exportar JSON</strong> salva as condições iniciais para compartilhar ou importar depois.</p>
    </section>

    <section className="panel manual-section" id="json">
      <p className="eyebrow">04 · Cenário editável</p><h2>Layout do JSON</h2>
      <p>No editor, clique em <strong>Importar JSON</strong> e escolha um arquivo <code>.json</code>. Os campos são carregados no formulário; revise a validação e clique em <strong>Executar simulação</strong>. Para obter um modelo do seu cenário, use <strong>Exportar JSON</strong>.</p>
      <CodeExample label="orbital-scenario.json · exemplo mínimo completo">{jsonExample}</CodeExample>
      <div className="manual-table-wrap"><table className="manual-table"><thead><tr><th>Campo</th><th>Significado</th></tr></thead><tbody>
        <tr><td><code>gravity</code></td><td>Constante gravitacional G em m³/(kg·s²); positiva.</td></tr>
        <tr><td><code>softeningMeters</code></td><td>Suavização gravitacional ε em metros; 0 usa a força newtoniana entre posições distintas.</td></tr>
        <tr><td><code>timeStepSeconds</code></td><td>Duração de cada passo em segundos; não pode ser 0. Valor negativo integra para trás.</td></tr>
        <tr><td><code>steps</code> / <code>sampleEverySteps</code></td><td>Total de passos e intervalo entre amostras; inteiros positivos. O estado inicial e o último passo também são registrados.</td></tr>
        <tr><td><code>integrator</code></td><td>Opcional: <code>verlet</code> (padrão), <code>yoshida4</code> ou <code>rk4</code>.</td></tr>
        <tr><td><code>bodies</code></td><td>Lista de corpos. Cada um tem nome único, <code>massKg</code> ≥ 0 e vetores XYZ de posição em m e velocidade em m/s. Ao menos um corpo precisa de massa positiva.</td></tr>
      </tbody></table></div>
      <h3>Corpos e seções opcionais</h3>
      <p>Em vez de <code>positionMeters</code> e <code>velocityMetersPerSecond</code>, um corpo pode ter <code>orbit</code> com <code>around</code>, <code>semiMajorAxisMeters</code>, <code>eccentricity</code> e os ângulos <code>inclinationDegrees</code>, <code>ascendingNodeDegrees</code>, <code>argumentOfPeriapsisDegrees</code> e <code>trueAnomalyDegrees</code>. O corpo central deve aparecer antes na lista e ter massa positiva. <code>radiusMeters</code> serve às colisões; <code>dragAreaPerMassSquareMetersPerKg</code>, ao arrasto.</p>
      <p><code>physics</code> configura J2, atmosfera, relatividade e colisões; efeitos centrais exigem <code>centralBody</code>. <code>particleGroups</code> cria anéis ou discos com corpo central, quantidade e raios interno/externo. <code>maneuvers</code> aplica <code>deltaVelocityMetersPerSecond</code> e, opcionalmente, <code>deltaPositionMeters</code> em um <code>step</code> anterior ao fim.</p>
      <div className="manual-note">Use números JSON com ponto decimal e sem unidade escrita no valor. O formulário aceita vírgula decimal, mas o arquivo JSON deve seguir a sintaxe JSON. A execução web limita 32 corpos, 2.000 partículas, 8 grupos, 100 manobras, 3.000.000 de passos e 1.001 amostras.</div>
    </section>

    <section className="panel manual-section" id="opcionais">
      <p className="eyebrow">05 · Configuração avançada</p><h2>Órbitas, física, partículas e manobras</h2>
      <p>As seções abaixo são opcionais no JSON e têm equivalentes no editor. Seções ausentes deixam os efeitos desligados; dentro de uma seção usada, os parâmetros precisam ser consistentes.</p>
      <div className="manual-table-wrap"><table className="manual-table"><thead><tr><th>Seção/campo</th><th>Como funciona</th></tr></thead><tbody>
        <tr><td><code>orbit.around</code></td><td>Nome de um corpo com massa listado antes. O motor converte os elementos em posição e velocidade iniciais.</td></tr>
        <tr><td><code>semiMajorAxisMeters</code> e <code>eccentricity</code></td><td>Elipse: a &gt; 0 e 0 ≤ e &lt; 1. Hipérbole: a &lt; 0 e e &gt; 1. e = 1 não é aceita.</td></tr>
        <tr><td>Ângulos da <code>orbit</code></td><td>Inclinação, nodo ascendente, argumento do periastro e anomalia verdadeira, todos em graus. A anomalia 0° fica no periastro.</td></tr>
        <tr><td><code>physics.centralBody</code></td><td>Corpo com massa usado como referência de J2, arrasto atmosférico e correção relativística.</td></tr>
        <tr><td><code>physics.j2</code> / <code>centralRadiusMeters</code></td><td>J2 é adimensional e modela o achatamento. Exige raio equatorial positivo em metros.</td></tr>
        <tr><td><code>atmosphereDensityKgPerCubicMeter</code> / <code>atmosphereScaleHeightMeters</code></td><td>Densidade superficial ρ₀ em kg/m³ e altura de escala H em m para atmosfera exponencial. Densidade positiva exige H e raio central positivos; o arrasto de cada corpo usa seu <code>dragAreaPerMassSquareMetersPerKg</code>.</td></tr>
        <tr><td><code>lightSpeedMetersPerSecond</code></td><td>Valor positivo liga a correção relativística 1PN; use a velocidade da luz física para um cenário realista.</td></tr>
        <tr><td><code>physics.collisions</code> / <code>radiusMeters</code></td><td>Com colisões ligadas, corpos cujos raios se tocam se fundem. Um raio 0 significa corpo pontual.</td></tr>
        <tr><td><code>particleGroups</code></td><td>Cada grupo tem <code>name</code>, <code>around</code>, <code>count</code>, <code>innerRadiusMeters</code>, <code>outerRadiusMeters</code>, <code>eccentricity</code>, <code>inclinationDegrees</code> e <code>ascendingNodeDegrees</code>. Partículas não exercem gravidade sobre os corpos.</td></tr>
        <tr><td><code>maneuvers</code></td><td>Cada manobra indica <code>body</code>, <code>step</code> e vetor XYZ <code>deltaVelocityMetersPerSecond</code>; <code>deltaPositionMeters</code> é opcional. O passo deve ser anterior ao último.</td></tr>
      </tbody></table></div>
      <div className="manual-note">Todos os comprimentos são em metros, massas em quilogramas, tempos em segundos e velocidades em m/s. Corpos com <code>massKg: 0</code> sentem a gravidade, mas não a exercem. Grupos de partículas são adequados a anéis e discos grandes.</div>
    </section>

    <section className="panel manual-section" id="csv">
      <p className="eyebrow">06 · Resultados calculados</p><h2>Layout dos CSVs</h2>
      <p>Clique em <strong>Importar CSV</strong> no topo da página. Selecione <code>trajectory.csv</code> e, se tiver, os arquivos opcionais na mesma seleção. Eles contêm resultados de uma simulação já calculada e serão abertos em <strong>Resultados</strong>.</p>
      <p>Os nomes dos arquivos devem ser exatamente os indicados abaixo. O separador é vírgula, a primeira linha traz os nomes das colunas e os números usam ponto decimal. A ordem das colunas pode variar, pois a leitura usa o cabeçalho.</p>
      <div className="manual-file-list">{csvFiles.map(file => <article className="manual-file" key={file.name}>
        <div className="manual-file-title"><h3><code>{file.name}</code></h3><span className="badge">{file.use}</span></div>
        <p>{file.detail}</p><span className="manual-field-label">Colunas exigidas pelo importador</span><code className="manual-columns">{file.columns}</code>
        <span className="manual-field-label">Exemplo de cabeçalho completo</span><code className="manual-columns">{file.header}</code>
      </article>)}</div>
      <CodeExample label="trajectory.csv · duas amostras, dois corpos">{trajectoryExample}</CodeExample>
      <div className="manual-note"><strong>Regras da trajetória:</strong> cada amostra deve conter os mesmos corpos, uma linha por corpo, com o mesmo <code>step</code> e <code>time_s</code>. Os passos são inteiros não negativos e o tempo deve seguir sempre no mesmo sentido. Cada amostra precisa de ao menos um corpo ativo com massa positiva. <code>radius_m</code> e <code>active</code> podem faltar em arquivos antigos.</div>
      <p><code>diagnostics.csv</code> habilita os gráficos de energia e momento; <code>events.csv</code> preenche a lista e os marcadores de eventos; <code>particles.csv</code> desenha as partículas. <code>summary.json</code> não faz parte da importação. Após recarregar a página, selecione os CSVs novamente.</p>
    </section>

    <section className="panel manual-section" id="resultados">
      <p className="eyebrow">07 · Exploração</p><h2>Como ler os resultados</h2>
      <div className="manual-file-list">
        <article className="manual-file"><h3>Trajetória e tempo</h3><p>Use reproduzir, pausar, avançar, retroceder e a barra de tempo. Arraste a cena para girar e use a roda do mouse para aproximar. O desenho ajusta a escala à tela; as posições continuam em metros.</p></article>
        <article className="manual-file"><h3>Corpos e órbitas</h3><p>Selecione um corpo para ver posição, velocidade e elementos orbitais. As vistas 3D, XY e XZ mudam apenas a câmera. O referencial girante ajuda a observar o movimento relativo dos corpos mais massivos.</p></article>
        <article className="manual-file"><h3>Energia e eventos</h3><p>Os diagnósticos mostram energia, momento e deriva ao longo da simulação. Eventos marcam encontros, colisões, apsides, escapes e manobras quando disponíveis.</p></article>
        <article className="manual-file"><h3>Experimentar</h3><p>Uma simulação executada no app permite comparar integradores, aplicar impulsos, mover corpos ou voltar no tempo quando a ação estiver disponível. Para resultados importados de CSV, essas ações exigem o cenário JSON original e uma nova execução.</p></article>
      </div>
      <h3>Controles e interpretação</h3>
      <p>Na linha do tempo, <strong>Espaço</strong> reproduz ou pausa, <strong>←</strong> e <strong>→</strong> mudam a amostra e <strong>L</strong> liga a repetição. É possível escolher velocidades de 0,25× a 8×. No canvas, arraste para girar, role para zoom, dê dois cliques para redefinir a câmera e alterne entre 3D, XY e XZ. O referencial girante acompanha os dois corpos mais massivos; com um corpo selecionado, a vista inercial pode segui-lo.</p>
      <p>Os valores de energia (J), momento linear (kg·m/s) e momento angular (kg·m²/s) vêm do motor. A deriva relativa de energia compara cada amostra à energia inicial. Pequena oscilação pode ser normal nos integradores simpléticos; crescimento sistemático pede Δt menor ou revisão da física. A opção <strong>Comparar integradores</strong> roda o mesmo cenário com Verlet, Yoshida e RK4 sem as partículas de grupos.</p>
      <p>Os eventos são filtráveis: colisão, periastro (menor distância), apoastro (maior distância), escape e manobra. Os marcadores levam ao passo associado. O sandbox converte um impulso prógrado, radial ou normal em manobra no passo atual e recalcula; a ferramenta de mover altera a posição. <strong>Voltar no tempo</strong> integra a partir da amostra escolhida quando o cenário permite e informa a diferença em relação ao estado inicial.</p>
    </section>

    <section className="panel manual-section" id="precisao">
      <p className="eyebrow">08 · Entender</p><h2>Precisão e escolhas de simulação</h2>
      <p>A simulação avança em intervalos fixos de tempo. Um Δt menor costuma descrever melhor passagens rápidas e encontros próximos, mas exige mais passos. A suavização ε evita forças extremas em distâncias muito pequenas; com ε = 0, dois corpos na mesma posição causam erro.</p>
      <div className="manual-table-wrap"><table className="manual-table"><thead><tr><th>Integrador</th><th>Uso e comportamento</th></tr></thead><tbody>
        <tr><td>Velocity Verlet</td><td>Opção padrão. Rápida e adequada como ponto de partida para órbitas longas; a energia pode oscilar levemente.</td></tr>
        <tr><td>Yoshida</td><td>Maior precisão por passo em muitos cenários conservativos, com cálculo mais demorado.</td></tr>
        <tr><td>Runge-Kutta 4</td><td>Útil para comparar resultados em intervalos curtos. Observe a deriva de energia em simulações longas.</td></tr>
      </tbody></table></div>
      <p>O J2 pode mostrar a precessão causada pelo achatamento do corpo central. A atmosfera produz arrasto e pode diminuir a energia da órbita. A correção relativística 1PN altera principalmente a orientação do periastro. Com colisões ligadas, corpos cujos raios se tocam se fundem; o corpo mais massivo permanece ativo.</p>
      <p>Se o app sugerir um Δt menor, execute novamente e compare a trajetória e os diagnósticos. Energia e momento ajudam a avaliar a estabilidade; não espere valores perfeitamente constantes a cada amostra. Um cenário com arrasto ou colisão pode mudar a energia por causa da própria física.</p>
      <div className="manual-note">Os resultados são aproximações numéricas. Revise unidades, condições iniciais e diagnósticos antes de usá-los em qualquer análise.</div>
    </section>

    <section className="panel manual-section" id="sessao">
      <p className="eyebrow">09 · Continuar depois</p><h2>Sessão, arquivos e limites</h2>
      <p>O rascunho do editor fica salvo neste navegador. Ao abrir Resultados novamente após recarregar a página, a última simulação criada no app pode ser recalculada. Resultados importados por CSV não ficam salvos: selecione os arquivos novamente. Para guardar um cenário de forma portátil, use <strong>Exportar JSON</strong>.</p>
      <p>Uma execução web aceita até 32 corpos, 2.000 partículas em 8 grupos, 100 manobras, 3.000.000 de passos e 1.001 amostras. Também há limites para a combinação de partículas, amostras e trabalho de cálculo. Se o resumo indicar excesso, reduza corpos ou partículas, diminua passos ou aumente <code>sampleEverySteps</code>.</p>
      <div className="manual-note">A interface não oferece exportação de CSV. <strong>Exportar JSON</strong> salva o cenário, enquanto <strong>Importar CSV</strong> abre resultados já calculados.</div>
    </section>

    <section className="panel manual-section" id="ajuda">
      <p className="eyebrow">10 · Ajuda</p><h2>Problemas comuns</h2>
      <div className="manual-file-list">
        <article className="manual-file"><h3>Motor indisponível</h3><p>Se o indicador no topo mostrar “API indisponível”, recarregue a página e tente mais tarde. Se o problema persistir, avise quem mantém o site; a simulação depende do serviço de cálculo.</p></article>
        <article className="manual-file"><h3>JSON recusado</h3><p>Revise a sintaxe, números finitos, nomes únicos, corpo com massa positiva e vetores com três valores. Em órbitas, o corpo central precisa aparecer antes. O erro de validação no editor identifica o campo.</p></article>
        <article className="manual-file"><h3>CSV recusado ou incompleto</h3><p>Selecione <code>trajectory.csv</code> com esse nome exato. Confirme cabeçalhos, vírgulas como separadores e ponto decimal. Todas as amostras precisam conter os mesmos corpos; os demais arquivos são opcionais.</p></article>
        <article className="manual-file"><h3>Resultado instável</h3><p>Confirme unidades SI, posições iniciais, suavização e passo de tempo. Reduza Δt e compare os diagnósticos e integradores. Com ε = 0, corpos na mesma posição são inválidos.</p></article>
      </div>
      <h3>Unidades mais usadas</h3>
      <p><code>m</code>: metros (posição, raio e distância); <code>kg</code>: quilogramas (massa); <code>s</code>: segundos (tempo); <code>m/s</code>: velocidade; <code>J</code>: energia; <code>°</code>: ângulos de elementos orbitais. Um número como <code>7e6</code> significa 7 × 10⁶, ou 7.000.000.</p>
      <div className="manual-actions"><Link className="button primary" to="/editor">Criar cenário</Link><Link className="button subtle" to="/">Explorar simulações</Link></div>
    </section>
  </div>;
}
