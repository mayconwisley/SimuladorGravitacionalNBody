// Workspace tabs and their URLs. Keeping the tab in the URL lets F5 and the browser
// history return to the same screen.
export const routes = [
  { key: 'catalog', path: '/', label: 'Simulações', icon: 'grid', title: 'Simulações' },
  { key: 'editor', path: '/editor', label: 'Criar cenário', icon: 'sliders', title: 'Criar cenário' },
  { key: 'results', path: '/resultados', label: 'Resultados', icon: 'orbit', title: 'Resultados' }
];

export function routeForPath(pathname) {
  const normalized = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  return routes.find(route => route.path === normalized) ?? null;
}

export function pathForTab(key) {
  return routes.find(route => route.key === key)?.path ?? '/';
}
