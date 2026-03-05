module.exports = function handler(req, res) {
  const component_types = [
    'transformers', 'cables', 'lines', 'generators', 'motors',
    'circuit-breakers', 'disconnectors', 'fuses',
    'current-transformers', 'voltage-transformers',
    'protection-relays', 'busbars'
  ];
  res.json({
    component_types,
    endpoints: component_types.map(k => `/api/library/${k}`)
  });
};
