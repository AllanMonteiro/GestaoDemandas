import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.models.demanda_gestao import DemandaAnaliseMetodo, DemandaAnaliseStatus
from app.schemas.demanda_gestao import DemandaAnaliseCreate
from app.services.demand_analysis import (
    calculate_gut_score,
    classify_effort_impact,
    classify_gut_score,
    enrich_field_map,
    validate_analysis_payload,
)


def test_criar_analise_schema_aceita_gut():
    analise = DemandaAnaliseCreate(
        metodo=DemandaAnaliseMetodo.gut,
        problema='Falha no processo',
        campos=[
            {'chave': 'gravidade', 'valor': 5, 'ordem': 0},
            {'chave': 'urgencia', 'valor': 3, 'ordem': 1},
            {'chave': 'tendencia', 'valor': 2, 'ordem': 2},
        ],
    )
    assert analise.metodo == DemandaAnaliseMetodo.gut
    assert len(analise.campos) == 3


def test_metodo_invalido_rejeitado():
    with pytest.raises(ValidationError):
        DemandaAnaliseCreate(metodo='XPTO', problema='Teste')


def test_calculo_pontuacao_gut():
    assert calculate_gut_score(5, 4, 3) == 60


@pytest.mark.parametrize(
    ('score', 'classificacao'),
    [
        (10, 'baixa prioridade'),
        (60, 'media prioridade'),
        (120, 'alta prioridade'),
    ],
)
def test_classificacao_gut(score: int, classificacao: str):
    assert classify_gut_score(score) == classificacao


@pytest.mark.parametrize(
    ('impacto', 'esforco', 'classificacao'),
    [
        ('alto', 'baixo', 'prioridade maxima'),
        ('alto', 'alto', 'projeto estrategico'),
        ('baixo', 'baixo', 'fazer se houver tempo'),
        ('baixo', 'alto', 'evitar ou repensar'),
        ('medio', 'alto', 'prioridade intermediaria'),
    ],
)
def test_classificacao_esforco_impacto(impacto: str, esforco: str, classificacao: str):
    assert classify_effort_impact(impacto, esforco) == classificacao


def test_gut_enriquecida_com_pontuacao_e_classificacao():
    enriched = enrich_field_map(
        DemandaAnaliseMetodo.gut,
        {'gravidade': '5', 'urgencia': '5', 'tendencia': '4'},
    )
    assert enriched['pontuacao_total'] == '100'
    assert enriched['classificacao_prioridade'] == 'alta prioridade'


def test_salvamento_rascunho_4w2h_aceita_campos_incompletos():
    validate_analysis_payload(
        DemandaAnaliseMetodo.quatro_w_dois_h,
        DemandaAnaliseStatus.rascunho,
        problema=None,
        causa_raiz=None,
        field_map={'what': 'Mapear processo'},
    )


def test_4w2h_em_analise_exige_campos_minimos():
    with pytest.raises(ValueError, match='Campos obrigatorios nao informados'):
        validate_analysis_payload(
            DemandaAnaliseMetodo.quatro_w_dois_h,
            DemandaAnaliseStatus.em_analise,
            problema='Plano incompleto',
            causa_raiz=None,
            field_map={'what': 'Ajustar fluxo'},
        )


def test_5_porques_aceita_entre_um_e_cinco_porques():
    validate_analysis_payload(
        DemandaAnaliseMetodo.cinco_porques,
        DemandaAnaliseStatus.em_analise,
        problema='Falha recorrente',
        causa_raiz='Treinamento insuficiente',
        field_map={'porque_1': 'O processo nao foi seguido'},
    )


def test_gut_invalida_valor_fora_do_intervalo():
    with pytest.raises(ValueError, match='deve estar entre 1 e 5'):
        validate_analysis_payload(
            DemandaAnaliseMetodo.gut,
            DemandaAnaliseStatus.em_analise,
            problema='Problema critico',
            causa_raiz=None,
            field_map={'gravidade': '6', 'urgencia': '5', 'tendencia': '5'},
        )


def test_criar_listar_atualizar_e_excluir_analise_por_api(client: TestClient, seed_data: dict[str, object]):
    demanda = seed_data['demanda']

    create_response = client.post(
        f'/api/gestao-demandas/{demanda.id}/analises',
        json={
            'metodo': 'GUT',
            'problema': 'Fila parada',
            'status': 'em_analise',
            'campos': [
                {'chave': 'gravidade', 'valor': 5, 'ordem': 0},
                {'chave': 'urgencia', 'valor': 4, 'ordem': 1},
                {'chave': 'tendencia', 'valor': 3, 'ordem': 2},
            ],
        },
    )
    assert create_response.status_code == 201
    created_body = create_response.json()
    assert created_body['metodo'] == 'GUT'
    assert created_body['responsavel_id'] is not None
    assert created_body['pontuacao_total'] == 60
    assert created_body['classificacao'] == 'media prioridade'

    list_response = client.get(f'/api/gestao-demandas/{demanda.id}/analises')
    assert list_response.status_code == 200
    listed_items = list_response.json()
    assert len(listed_items) == 1
    assert listed_items[0]['id'] == created_body['id']

    update_response = client.put(
        f"/api/gestao-demandas/analises/{created_body['id']}",
        json={
            'problema': 'Fila priorizada',
            'status': 'plano_definido',
            'campos': [
                {'chave': 'gravidade', 'valor': 5, 'ordem': 0},
                {'chave': 'urgencia', 'valor': 5, 'ordem': 1},
                {'chave': 'tendencia', 'valor': 5, 'ordem': 2},
            ],
        },
    )
    assert update_response.status_code == 200
    updated_body = update_response.json()
    assert updated_body['problema'] == 'Fila priorizada'
    assert updated_body['status'] == 'plano_definido'
    assert updated_body['pontuacao_total'] == 125
    assert updated_body['classificacao'] == 'alta prioridade'

    delete_response = client.delete(f"/api/gestao-demandas/analises/{created_body['id']}")
    assert delete_response.status_code == 200
    assert delete_response.json()['mensagem'] == 'Analise removida com sucesso.'

    list_after_delete = client.get(f'/api/gestao-demandas/{demanda.id}/analises')
    assert list_after_delete.status_code == 200
    assert list_after_delete.json() == []


def test_metodo_invalido_retorna_422_na_api(client: TestClient, seed_data: dict[str, object]):
    demanda = seed_data['demanda']
    response = client.post(
        f'/api/gestao-demandas/{demanda.id}/analises',
        json={
            'metodo': 'METODO_X',
            'problema': 'Erro de validacao',
            'status': 'rascunho',
            'campos': [],
        },
    )
    assert response.status_code == 422


def test_salvar_rascunho_4w2h_por_api(client: TestClient, seed_data: dict[str, object]):
    demanda = seed_data['demanda']
    response = client.post(
        f'/api/gestao-demandas/{demanda.id}/analises',
        json={
            'metodo': '4W2H',
            'status': 'rascunho',
            'campos': [
                {'chave': 'what', 'valor': 'Revisar processo', 'ordem': 0},
            ],
        },
    )
    assert response.status_code == 201
    body = response.json()
    assert body['status'] == 'rascunho'
    assert body['campos_map']['what'] == 'Revisar processo'


def test_criar_subdemanda_vinculada_e_listar_na_demanda_pai(client: TestClient, seed_data: dict[str, object]):
    demanda_pai = seed_data['demanda']

    create_response = client.post(
        '/api/gestao-demandas',
        json={
            'titulo': 'Subdemanda vinculada',
            'descricao': 'Item derivado da demanda principal',
            'parent_demanda_id': demanda_pai.id,
            'prioridade': 'alta',
        },
    )
    assert create_response.status_code == 201
    created_body = create_response.json()
    assert created_body['parent_demanda_id'] == demanda_pai.id
    assert created_body['parent_titulo'] == demanda_pai.titulo

    list_response = client.get('/api/gestao-demandas')
    assert list_response.status_code == 200
    listed_items = list_response.json()
    assert len(listed_items) == 1
    assert listed_items[0]['id'] == demanda_pai.id
    assert listed_items[0]['total_subdemandas'] == 1

    parent_detail_response = client.get(f'/api/gestao-demandas/{demanda_pai.id}')
    assert parent_detail_response.status_code == 200
    parent_detail = parent_detail_response.json()
    assert len(parent_detail['subdemandas']) == 1
    assert parent_detail['subdemandas'][0]['id'] == created_body['id']

    subdemands_response = client.get('/api/gestao-demandas', params={'parent_demanda_id': demanda_pai.id})
    assert subdemands_response.status_code == 200
    subdemandas = subdemands_response.json()
    assert len(subdemandas) == 1
    assert subdemandas[0]['parent_demanda_id'] == demanda_pai.id
