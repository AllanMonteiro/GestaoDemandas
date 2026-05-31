from __future__ import annotations

from collections.abc import Iterable

from app.models.demanda_gestao import DemandaAnaliseMetodo, DemandaAnaliseStatus


GUT_KEYS = ('gravidade', 'urgencia', 'tendencia')
ESFORCO_IMPACTO_VALORES = {'baixo', 'medio', 'alto'}

METHOD_FIELD_ORDER: dict[DemandaAnaliseMetodo, list[str]] = {
    DemandaAnaliseMetodo.cinco_porques: [
        'porque_1',
        'porque_2',
        'porque_3',
        'porque_4',
        'porque_5',
        'acao_recomendada',
    ],
    DemandaAnaliseMetodo.quatro_w_dois_h: ['what', 'why', 'where', 'when', 'who', 'how'],
    DemandaAnaliseMetodo.cinco_w_dois_h: ['what', 'why', 'where', 'when', 'who', 'how', 'how_much'],
    DemandaAnaliseMetodo.ishikawa: [
        'metodo',
        'maquina_sistema',
        'mao_de_obra_pessoas',
        'material_insumos',
        'meio_ambiente',
        'medicao_indicadores',
        'causa_provavel',
    ],
    DemandaAnaliseMetodo.gut: ['gravidade', 'urgencia', 'tendencia', 'pontuacao_total', 'classificacao_prioridade'],
    DemandaAnaliseMetodo.esforco_impacto: ['impacto', 'esforco', 'classificacao'],
    DemandaAnaliseMetodo.pdca: [
        'plan',
        'do',
        'check',
        'act',
        'resultado_esperado',
        'resultado_obtido',
        'proximo_ciclo_necessario',
    ],
}


def normalize_field_value(value: object) -> str | None:
    if value is None:
        return None
    if isinstance(value, bool):
        return 'sim' if value else 'nao'
    text = str(value).strip()
    return text or None


def normalize_problem_text(value: str | None) -> str | None:
    if value is None:
        return None
    text = value.strip()
    return text or None


def fields_to_map(fields: Iterable[object]) -> dict[str, str | None]:
    result: dict[str, str | None] = {}
    for field in fields:
        key = getattr(field, 'chave', None)
        if key is None and isinstance(field, dict):
            key = field.get('chave')
        if not key:
            continue
        value = getattr(field, 'valor', None)
        if value is None and isinstance(field, dict):
            value = field.get('valor')
        result[str(key).strip()] = normalize_field_value(value)
    return result


def calculate_gut_score(gravidade: int, urgencia: int, tendencia: int) -> int:
    return gravidade * urgencia * tendencia


def classify_gut_score(score: int) -> str:
    if score <= 25:
        return 'baixa prioridade'
    if score <= 75:
        return 'media prioridade'
    return 'alta prioridade'


def classify_effort_impact(impacto: str, esforco: str) -> str:
    impacto_norm = impacto.strip().lower()
    esforco_norm = esforco.strip().lower()
    if impacto_norm == 'alto' and esforco_norm == 'baixo':
        return 'prioridade maxima'
    if impacto_norm == 'alto' and esforco_norm == 'alto':
        return 'projeto estrategico'
    if impacto_norm == 'baixo' and esforco_norm == 'baixo':
        return 'fazer se houver tempo'
    if impacto_norm == 'baixo' and esforco_norm == 'alto':
        return 'evitar ou repensar'
    return 'prioridade intermediaria'


def enrich_field_map(method: DemandaAnaliseMetodo, field_map: dict[str, str | None]) -> dict[str, str | None]:
    enriched = dict(field_map)
    if method == DemandaAnaliseMetodo.gut:
        gut_values = parse_gut_values(enriched)
        if gut_values:
            score = calculate_gut_score(*gut_values)
            enriched['pontuacao_total'] = str(score)
            enriched['classificacao_prioridade'] = classify_gut_score(score)
    elif method == DemandaAnaliseMetodo.esforco_impacto:
        impacto = normalize_field_value(enriched.get('impacto'))
        esforco = normalize_field_value(enriched.get('esforco'))
        if impacto and esforco:
            enriched['classificacao'] = classify_effort_impact(impacto, esforco)
    return enriched


def build_field_rows(method: DemandaAnaliseMetodo, field_map: dict[str, str | None]) -> list[dict[str, object]]:
    ordered_keys = list(METHOD_FIELD_ORDER.get(method, []))
    extras = sorted(key for key in field_map.keys() if key not in ordered_keys)
    keys = ordered_keys + extras
    rows: list[dict[str, object]] = []
    for index, key in enumerate(keys):
        if key not in field_map:
            continue
        rows.append({'chave': key, 'valor': field_map[key], 'ordem': index})
    return rows


def parse_gut_values(field_map: dict[str, str | None]) -> tuple[int, int, int] | None:
    parsed: list[int] = []
    for key in GUT_KEYS:
        raw_value = normalize_field_value(field_map.get(key))
        if raw_value is None:
            return None
        try:
            parsed_value = int(raw_value)
        except ValueError as exc:
            raise ValueError(f'O campo {key} deve ser numerico.') from exc
        if parsed_value < 1 or parsed_value > 5:
            raise ValueError(f'O campo {key} deve estar entre 1 e 5.')
        parsed.append(parsed_value)
    return parsed[0], parsed[1], parsed[2]


def validate_analysis_payload(
    method: DemandaAnaliseMetodo,
    status: DemandaAnaliseStatus,
    problema: str | None,
    causa_raiz: str | None,
    field_map: dict[str, str | None],
) -> None:
    problema_normalizado = normalize_problem_text(problema)
    causa_raiz_normalizada = normalize_problem_text(causa_raiz)

    if status == DemandaAnaliseStatus.rascunho:
        if method == DemandaAnaliseMetodo.gut:
            parse_gut_values_if_present(field_map)
        if method == DemandaAnaliseMetodo.esforco_impacto:
            validate_effort_impact_if_present(field_map)
        return

    if not problema_normalizado:
        raise ValueError('Informe o problema da analise.')

    if method == DemandaAnaliseMetodo.cinco_porques:
        porques_preenchidos = [field_map.get(f'porque_{index}') for index in range(1, 6) if normalize_field_value(field_map.get(f'porque_{index}'))]
        if not porques_preenchidos:
            raise ValueError('Informe ao menos um "por que?" para a metodologia 5 Porques.')
        if not causa_raiz_normalizada:
            raise ValueError('Informe a causa raiz para a metodologia 5 Porques.')
        return

    if method == DemandaAnaliseMetodo.quatro_w_dois_h:
        validate_required_keys(field_map, ('what', 'why', 'where', 'when', 'who', 'how'))
        return

    if method == DemandaAnaliseMetodo.cinco_w_dois_h:
        validate_required_keys(field_map, ('what', 'why', 'where', 'when', 'who', 'how', 'how_much'))
        return

    if method == DemandaAnaliseMetodo.ishikawa:
        categorias = (
            'metodo',
            'maquina_sistema',
            'mao_de_obra_pessoas',
            'material_insumos',
            'meio_ambiente',
            'medicao_indicadores',
            'causa_provavel',
        )
        if not any(normalize_field_value(field_map.get(key)) for key in categorias):
            raise ValueError('Preencha ao menos uma categoria do Ishikawa ou a causa provavel.')
        if not causa_raiz_normalizada:
            raise ValueError('Informe a causa raiz para a metodologia Ishikawa.')
        return

    if method == DemandaAnaliseMetodo.gut:
        gut_values = parse_gut_values(field_map)
        if gut_values is None:
            raise ValueError('Informe gravidade, urgencia e tendencia para a matriz GUT.')
        return

    if method == DemandaAnaliseMetodo.esforco_impacto:
        validate_effort_impact_if_present(field_map, require_both=True)
        return

    if method == DemandaAnaliseMetodo.pdca:
        validate_required_keys(field_map, ('plan', 'do', 'check', 'act'))


def validate_required_keys(field_map: dict[str, str | None], required_keys: tuple[str, ...]) -> None:
    missing = [key for key in required_keys if not normalize_field_value(field_map.get(key))]
    if missing:
        missing_text = ', '.join(missing)
        raise ValueError(f'Campos obrigatorios nao informados: {missing_text}.')


def parse_gut_values_if_present(field_map: dict[str, str | None]) -> None:
    present = [normalize_field_value(field_map.get(key)) for key in GUT_KEYS]
    if any(value is not None for value in present):
        parse_gut_values(field_map)


def validate_effort_impact_if_present(field_map: dict[str, str | None], require_both: bool = False) -> None:
    impacto = normalize_field_value(field_map.get('impacto'))
    esforco = normalize_field_value(field_map.get('esforco'))
    if require_both and (not impacto or not esforco):
        raise ValueError('Informe impacto e esforco para a matriz Esforco x Impacto.')
    for key, value in {'impacto': impacto, 'esforco': esforco}.items():
        if value is None:
            continue
        if value.lower() not in ESFORCO_IMPACTO_VALORES:
            raise ValueError(f'O campo {key} deve ser baixo, medio ou alto.')
