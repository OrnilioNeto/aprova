"""Exporta a lista consolidada do PPRN (Excel/parquet) para CSV UTF-8 pronto para upload no Aprova."""
import argparse, os, sys
import pandas as pd

CANONICAL = {
    # origem (normalizado lower) -> canonico
    'posicao_geral': 'posicao_geral',
    'posicao_original_definitiva': 'posicao_original_definitiva',
    'nome': 'nome',
    'inscricao': 'inscricao',
    'inscricao_str': 'inscricao',
    'modalidade_concorrencia': 'modalidade_concorrencia',
    'modalidade': 'modalidade_concorrencia',
    'convocacao_fase_presencial': 'convocacao_fase_presencial',
    'nota_objetiva': 'nota_objetiva',
    'execucao_penal': 'Execucao Penal',
    'legislacao_especifica': 'Legislacao Especifica',
    'direito_penal_e_processo_penal': 'Direito Penal e Processo Penal',
    'lingua_portuguesa': 'Lingua Portuguesa',
    'direitos_humanos': 'Direitos Humanos',
    'direito_administrativo': 'Direito Administrativo',
    'direito_constitucional': 'Direito Constitucional',
    'historia_do_rn': 'Historia do RN',
    'etica_no_servico_publico': 'Etica no Servico Publico',
    'previsao_taf': 'previsao_taf',
    'previsao_vagas_imediatas': 'previsao_vagas_imediatas',
    'status_cota_preliminar': 'status_cota_preliminar',
    'cota_etnico_apta_preliminar': 'cota_etnico_apta_preliminar',
    'cota_pcd_apta_preliminar': 'cota_pcd_apta_preliminar',
    'nova_pos_lista_etnico': 'nova_pos_lista_etnico',
    'nova_pos_lista_pcd': 'nova_pos_lista_pcd',
    'ganho_pos_etnico': 'ganho_pos_etnico',
    'ganho_pos_pcd': 'ganho_pos_pcd',
    'convocado_taf_preliminar': 'convocado_taf_preliminar',
    'previsao_taf_preliminar': 'previsao_taf_preliminar',
    'previsao_vagas_preliminar': 'previsao_vagas_preliminar',
}

def norm(s):
    import unicodedata
    s = str(s).strip().lower()
    s = ''.join(c for c in unicodedata.normalize('NFD', s) if unicodedata.category(c) != 'Mn')
    return s

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('input', help='arquivo .xlsx ou .parquet')
    ap.add_argument('output', help='arquivo .csv de saida')
    args = ap.parse_args()

    path = args.input
    if path.endswith('.parquet'):
        df = pd.read_parquet(path)
    else:
        df = pd.read_excel(path)

    # normaliza colunas
    new_cols = {}
    for c in df.columns:
        nc = norm(c).replace(' ', '_')
        new_cols[c] = nc
    df = df.rename(columns=new_cols)

    # escreve CSV utf-8 com BOM
    df.to_csv(args.output, index=False, encoding='utf-8-sig')
    print('OK:', len(df), 'linhas ->', args.output)

if __name__ == '__main__':
    main()