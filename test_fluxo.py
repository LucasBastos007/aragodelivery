#!/usr/bin/env python3
"""
Teste de fluxo completo: pedido → loja aceita → loja finaliza → despacho → motoboy entrega
Roda 10 ciclos e gera relatório de bugs/lags.
"""
import json, time, uuid, requests
from datetime import datetime

SB_URL = "https://vgnqyalxqhgtlfbitpwx.supabase.co"
SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZnbnF5YWx4cWhndGxmYml0cHd4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDMyMDE1MSwiZXhwIjoyMDk1ODk2MTUxfQ.XnJPEqgi2lmK-UY022odfYzVSii5HHFrGt4F4mbYDMA"
MOTOBOY_ID = "c4cdc45e-ca42-4965-80e5-af05cb518b11"

HDRS = {
    "apikey": SB_KEY,
    "Authorization": f"Bearer {SB_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=representation",
}

LOJAS = [
    {"id": "fa5f7a59-05b4-4e40-ac48-b38412ed4287", "nome": "Júlia Duarte",
     "produto_id": "0905d6a2-17b9-4a49-bc26-c1fd3108aba1", "produto_nome": "X-Burguer", "preco": 18.9},
    {"id": "bf828351-1ed7-4401-aabd-c72be5033834", "nome": "Lucas Burguer",
     "produto_id": "237d1524-0c07-4d64-b787-5d6443f40beb", "produto_nome": "X-TUDO", "preco": 39.9},
    {"id": "5cf93dd6-811b-47f2-91e5-c1a7fc5f5fe3", "nome": "VIA ENCANTO",
     "produto_id": "65090e23-2f4b-4e58-a004-d5eec600c32e", "produto_nome": "Café com afeto", "preco": 259.0},
    {"id": "a14e1ce7-525c-43ea-b5ba-c0a3e0164ffd", "nome": "MegaSoft Sistemas",
     "produto_id": "45367b08-ba45-4f92-8b05-09c35edb4680", "produto_nome": "Pc Gamer", "preco": 6000.0},
]

# 10 testes: distribuídos entre as 4 lojas (3+3+2+2)
SEQUENCIA = [0,1,2,3, 0,1,2,3, 0,1]

results = []

def sb_get(path, params=""):
    url = f"{SB_URL}/rest/v1/{path}"
    if params:
        url += f"?{params}"
    return requests.get(url, headers=HDRS, timeout=10)

def sb_post(path, body):
    return requests.post(f"{SB_URL}/rest/v1/{path}", headers=HDRS, json=body, timeout=10)

def sb_patch(path, body, query):
    return requests.patch(f"{SB_URL}/rest/v1/{path}?{query}", headers=HDRS, json=body, timeout=10)

def sb_delete(path, query):
    return requests.delete(f"{SB_URL}/rest/v1/{path}?{query}", headers=HDRS, timeout=10)

def step(label, fn):
    t0 = time.time()
    try:
        resp = fn()
        elapsed = round((time.time() - t0) * 1000)
        ok = resp.status_code in (200, 201)
        data = resp.json() if resp.content else {}
        return ok, elapsed, resp.status_code, data
    except Exception as e:
        elapsed = round((time.time() - t0) * 1000)
        return False, elapsed, 0, {"error": str(e)}

print("=" * 60)
print(f"TESTE DE FLUXO COMPLETO — {datetime.now().strftime('%d/%m/%Y %H:%M:%S')}")
print("=" * 60)
print(f"Motoboy: Carlos Silva ({MOTOBOY_ID[:8]}...)")
print(f"Total de ciclos: {len(SEQUENCIA)}\n")

pedidos_criados = []  # para limpeza ao final

for i, loja_idx in enumerate(SEQUENCIA):
    loja = LOJAS[loja_idx]
    ciclo_num = i + 1
    ciclo = {"ciclo": ciclo_num, "loja": loja["nome"], "steps": [], "erros": [], "ok": True}

    print(f"▶ Ciclo {ciclo_num:02d}/10 — {loja['nome']}")

    # ── 1. Criar pedido ──────────────────────────────────────────
    total = loja["preco"]
    codigo = f"T{ciclo_num:03d}"  # ex: T001, T002... nunca colide com reais
    pedido_body = {
        "loja_id": loja["id"],
        "codigo": codigo,
        "status": "pendente",
        "forma_pagamento": "dinheiro",
        "subtotal": total,
        "taxa_entrega": 5.0,
        "total": total + 5.0,
        "endereco_entrega": f"Rua Teste, {ciclo_num} — Bairro Simulação, Aragoi­ânia",
        "lat_entrega": -16.9085 + (ciclo_num * 0.001),
        "lng_entrega": -49.4422 + (ciclo_num * 0.001),
        "observacao": f"Teste automatizado #{ciclo_num}",
        "desconto": 0,
    }
    ok, ms, code, data = step("criar_pedido", lambda b=pedido_body: sb_post("pedidos", b))
    ciclo["steps"].append({"step": "criar_pedido", "ok": ok, "ms": ms, "code": code})
    if not ok or not data or (isinstance(data, list) and len(data) == 0):
        ciclo["erros"].append(f"criar_pedido falhou: HTTP {code} — {data}")
        ciclo["ok"] = False
        print(f"   ✗ criar_pedido FALHOU ({ms}ms, HTTP {code})")
        results.append(ciclo)
        continue

    pedido = data[0] if isinstance(data, list) else data
    pedido_id = pedido.get("id")
    pedidos_criados.append(pedido_id)
    print(f"   ✓ criar_pedido ({ms}ms) → {pedido_id[:8]}...")

    # ── 2. Criar item do pedido ──────────────────────────────────
    item_body = {
        "pedido_id": pedido_id,
        "produto_id": loja["produto_id"],
        "nome": loja["produto_nome"],
        "preco": loja["preco"],
        "quantidade": 1,
        "observacao": "",
    }
    ok, ms, code, data = step("criar_item", lambda b=item_body: sb_post("itens_pedido", b))
    ciclo["steps"].append({"step": "criar_item", "ok": ok, "ms": ms, "code": code})
    if not ok:
        ciclo["erros"].append(f"criar_item falhou: HTTP {code} — {data}")
        ciclo["ok"] = False
        print(f"   ✗ criar_item FALHOU ({ms}ms, HTTP {code})")
        results.append(ciclo)
        continue
    print(f"   ✓ criar_item ({ms}ms)")

    # ── 3. Loja aceita ───────────────────────────────────────────
    ok, ms, code, data = step("loja_aceita", lambda pid=pedido_id, lid=loja["id"]:
        sb_patch("pedidos", {"status": "aceito"}, f"id=eq.{pid}&loja_id=eq.{lid}&status=eq.pendente"))
    ciclo["steps"].append({"step": "loja_aceita", "ok": ok, "ms": ms, "code": code})
    affected = len(data) if isinstance(data, list) else 0
    if not ok or affected == 0:
        ciclo["erros"].append(f"loja_aceita falhou: HTTP {code}, affected={affected}")
        ciclo["ok"] = False
        print(f"   ✗ loja_aceita FALHOU ({ms}ms, affected={affected})")
        results.append(ciclo)
        continue
    print(f"   ✓ loja_aceita ({ms}ms)")

    # ── 4. Loja preparando ───────────────────────────────────────
    ok, ms, code, data = step("loja_preparando", lambda pid=pedido_id, lid=loja["id"]:
        sb_patch("pedidos", {"status": "preparando"}, f"id=eq.{pid}&loja_id=eq.{lid}&status=eq.aceito"))
    ciclo["steps"].append({"step": "loja_preparando", "ok": ok, "ms": ms, "code": code})
    if not ok or len(data if isinstance(data, list) else []) == 0:
        ciclo["erros"].append(f"loja_preparando falhou: HTTP {code}")
        ciclo["ok"] = False
        print(f"   ✗ loja_preparando FALHOU ({ms}ms)")
        results.append(ciclo)
        continue
    print(f"   ✓ loja_preparando ({ms}ms)")

    # ── 5. Loja pronto ───────────────────────────────────────────
    ok, ms, code, data = step("loja_pronto", lambda pid=pedido_id, lid=loja["id"]:
        sb_patch("pedidos", {"status": "pronto"}, f"id=eq.{pid}&loja_id=eq.{lid}&status=eq.preparando"))
    ciclo["steps"].append({"step": "loja_pronto", "ok": ok, "ms": ms, "code": code})
    if not ok or len(data if isinstance(data, list) else []) == 0:
        ciclo["erros"].append(f"loja_pronto falhou: HTTP {code}")
        ciclo["ok"] = False
        print(f"   ✗ loja_pronto FALHOU ({ms}ms)")
        results.append(ciclo)
        continue
    print(f"   ✓ loja_pronto ({ms}ms)")

    # ── 6. Admin despacha motoboy ────────────────────────────────
    ok, ms, code, data = step("despachar", lambda pid=pedido_id:
        sb_patch("pedidos",
                 {"status": "aguardando_aceite", "motoboy_id": MOTOBOY_ID},
                 f"id=eq.{pid}&status=eq.pronto&motoboy_id=is.null"))
    ciclo["steps"].append({"step": "despachar", "ok": ok, "ms": ms, "code": code})
    affected = len(data) if isinstance(data, list) else 0
    if not ok or affected == 0:
        ciclo["erros"].append(f"despachar falhou: HTTP {code}, affected={affected} — {data}")
        ciclo["ok"] = False
        print(f"   ✗ despachar FALHOU ({ms}ms, affected={affected})")
        results.append(ciclo)
        continue
    print(f"   ✓ despachar ({ms}ms)")

    # ── 7. Motoboy aceita corrida ────────────────────────────────
    ok, ms, code, data = step("motoboy_aceita", lambda pid=pedido_id:
        sb_patch("pedidos", {"status": "a_caminho"},
                 f"id=eq.{pid}&motoboy_id=eq.{MOTOBOY_ID}&status=eq.aguardando_aceite"))
    ciclo["steps"].append({"step": "motoboy_aceita", "ok": ok, "ms": ms, "code": code})
    if not ok or len(data if isinstance(data, list) else []) == 0:
        ciclo["erros"].append(f"motoboy_aceita falhou: HTTP {code}")
        ciclo["ok"] = False
        print(f"   ✗ motoboy_aceita FALHOU ({ms}ms)")
        results.append(ciclo)
        continue
    print(f"   ✓ motoboy_aceita ({ms}ms)")

    # ── 8. Motoboy entrega ───────────────────────────────────────
    ok, ms, code, data = step("motoboy_entrega", lambda pid=pedido_id:
        sb_patch("pedidos", {"status": "entregue"},
                 f"id=eq.{pid}&motoboy_id=eq.{MOTOBOY_ID}&status=eq.a_caminho"))
    ciclo["steps"].append({"step": "motoboy_entrega", "ok": ok, "ms": ms, "code": code})
    if not ok or len(data if isinstance(data, list) else []) == 0:
        ciclo["erros"].append(f"motoboy_entrega falhou: HTTP {code}")
        ciclo["ok"] = False
        print(f"   ✗ motoboy_entrega FALHOU ({ms}ms)")
    else:
        print(f"   ✓ motoboy_entrega ({ms}ms)")

    results.append(ciclo)
    print()

# ── Limpeza: deleta todos os pedidos de teste ────────────────────
print("\n🧹 Limpando pedidos de teste...")
for pid in pedidos_criados:
    try:
        r = requests.delete(
            f"{SB_URL}/rest/v1/pedidos?id=eq.{pid}",
            headers={**HDRS, "Prefer": ""},
            timeout=10
        )
        # deleta os itens primeiro
        requests.delete(
            f"{SB_URL}/rest/v1/itens_pedido?pedido_id=eq.{pid}",
            headers={**HDRS, "Prefer": ""},
            timeout=10
        )
    except:
        pass

# ── Relatório ─────────────────────────────────────────────────────
print("\n" + "=" * 60)
print("RELATÓRIO FINAL")
print("=" * 60)

ciclos_ok = sum(1 for r in results if r["ok"])
print(f"\nResultado geral: {ciclos_ok}/10 ciclos OK\n")

for r in results:
    status_icon = "✅" if r["ok"] else "❌"
    tempos = [s["ms"] for s in r["steps"]]
    total_ms = sum(tempos)
    max_ms = max(tempos) if tempos else 0
    max_step = r["steps"][tempos.index(max_ms)]["step"] if tempos else "-"

    print(f"{status_icon} Ciclo {r['ciclo']:02d} | {r['loja']:<22} | Total: {total_ms}ms | Mais lento: {max_ms}ms ({max_step})")

    if r["erros"]:
        for e in r["erros"]:
            print(f"   ⚠ {e}")

# Análise de tempos por step
print("\n── Tempo médio por etapa ──────────────────────────────────")
step_names = ["criar_pedido","criar_item","loja_aceita","loja_preparando","loja_pronto","despachar","motoboy_aceita","motoboy_entrega"]
for sname in step_names:
    tempos = [s["ms"] for r in results for s in r["steps"] if s["step"] == sname]
    if tempos:
        media = round(sum(tempos)/len(tempos))
        maximo = max(tempos)
        flag = " ⚠ LENTO" if maximo > 2000 else ""
        print(f"  {sname:<22} avg={media:>5}ms  max={maximo:>5}ms{flag}")

# Erros encontrados
todos_erros = [e for r in results for e in r["erros"]]
if todos_erros:
    print(f"\n── Erros encontrados ({len(todos_erros)}) ───────────────────────────")
    for e in todos_erros:
        print(f"  • {e}")
else:
    print(f"\n── Sem erros encontrados ──────────────────────────────────")

print("\n" + "=" * 60)
print("FIM DO TESTE")
print("=" * 60)
