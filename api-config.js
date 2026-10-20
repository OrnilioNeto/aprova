/* ============================================================
   CONFIGURAÇÃO DA API PRÓPRIA (ValueHost / PHP)
   URL base do backend PHP hospedado no ValueHost.

   Exemplos:
     https://previaseg.com/api          (subpasta /api)
     https://api.previaseg.com          (subdomínio dedicado)

   Ajuste abaixo quando souber o endereço final do backend.
   ============================================================ */
/* Modo local: sem servidor. Dados salvos apenas neste navegador.
   Para usar a sincronização na nuvem (ValueHost), preencha a URL da API abaixo. */
window.API_BASE_URL = 'https://previaseg.com/api_aprova/valuehost-api';

/* URL pública do Trilium (online). Ajuste se mudar de túnel/domínio. */
window.TRILIUM_URL = 'https://brass-helmet-collect-payday.trycloudflare.com';

/* Token ETAPI do Trilium (para criar notas automaticamente). Mantenha em segredo. */
window.TRILIUM_ETAPI_TOKEN = 'XQEKVsDFgNb1_DTQjYjhJVCA8jSdQi46dYDB96umfmlgR40b+bv/D4+c=';
