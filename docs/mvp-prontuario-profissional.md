 (cd "$(git rev-parse --show-toplevel)" && git apply --3way <<'EOF' 
diff --git a//dev/null b/docs/mvp-prontuario-profissional.md
index 0000000000000000000000000000000000000000..26fb0621c41da7b2bbd3f272d9399cc2aba20528 100644
--- a//dev/null
+++ b/docs/mvp-prontuario-profissional.md
@@ -0,0 +1,264 @@
+# MVP do Prontuário do Profissional de Saúde Lilu
+
+## Visão Geral do MVP
+- **Objetivo**: disponibilizar uma versão navegável e funcional do prontuário do profissional, capaz de ser apresentada a investidores e utilizada por um grupo piloto.
+- **Escopo Prioritário**:
+  - Cadastro completo do profissional com validação mínima (CPF, conselho/UF, contato, aceite LGPD/HIPAA).
+  - Gestão de licenças Lilu (mensal/anual) com status `ativo` e `inadimplente` e bloqueio automático da Health Wallet.
+  - Painel simplificado da Health Wallet com leitura de consultas e evoluções somente quando houver consentimento ativo.
+  - Geração e registro de logs de auditoria para ações críticas.
+  - Exposição de dados essenciais via FHIR (`Practitioner`, `Encounter`, `Observation`).
+- **Premissas Técnicas**:
+  - Aplicação web responsiva (Next.js + TypeScript) hospedada em Vercel; API em Node.js (NestJS) hospedada em Render/Heroku.
+  - Banco PostgreSQL gerenciado (Supabase/Neon) com criptografia at rest e TLS.
+  - Autenticação com Auth0 (MFA opcional) e papéis `profissional` e `admin`.
+
+## 1. Checklist de Campos
+| Bloco | Campo | Obrigatório MVP | Exemplo | Observações |
+| --- | --- | --- | --- | --- |
+| Dados Pessoais | nome_completo | ✅ | "Dra. Ana Paula Ribeiro" | Bloquear caracteres especiais inválidos |
+| | cpf | ✅ | "123.456.789-00" | Máscara + validação dígito verificador |
+| | data_nascimento | ✅ | "1985-06-12" | Usar date picker |
+| | email | ✅ | "ana@lilu.com" | Verificar MX/format |
+| | telefone | ✅ | "+55 11 91234-5678" | Validar DDI/DDD |
+| | endereco_profissional | ⚪️ | "Rua das Flores, 100" | MVP: campo texto único |
+| | foto_url | ⚪️ | upload/URL segura | Upload com storage S3 compatível |
+| Credenciais | conselho_tipo | ✅ | "CRM" | Dropdown (CRM, CRP, CRN, CREFITO...) |
+| | conselho_numero | ✅ | "123456" | Regex específico por conselho |
+| | conselho_uf | ✅ | "SP" | Seleção de UF |
+| | status_validacao | ✅ | "pendente"/"verificado" | Atualizado via job de verificação |
+| | especialidades | ✅ | ["Cardiologia"] | Seleção múltipla |
+| | formacao | ⚪️ | lista texto | Pode ser texto livre no MVP |
+| Compliance | status_registro | ✅ | "ativo"/"suspenso" | Vinculado à validação do conselho |
+| | certificados | ⚪️ | upload PDF | MVP: upload manual sem OCR |
+| | aceite_termos | ✅ | {versao:"3.2", data:"2024-01-10"} | Guardar IP origem |
+| Licenciamento Lilu | plano | ✅ | "mensal"/"anual" | Dropdown |
+| | valor | ✅ | 249.00 | Moeda BRL |
+| | status_licenca | ✅ | "ativo"/"inadimplente" | Estado derivado da cobrança |
+| | ciclo_inicio/fim | ✅ | "2024-02-01"/"2024-03-01" | Display no painel |
+| | renovacao_automatica | ⚪️ | true | Checkbox |
+| | historico_faturas | ⚪️ | lista | MVP: JSON com nº, vencimento, status |
+| Consentimento Health Wallet | consentimento_status | ✅ | "completo"/"parcial"/"nenhum" | Flag global |
+| | escopos | ✅ | {consultas:true, evolucoes:true} | MVP cobre consultas e evoluções |
+| | consentido_em | ✅ | timestamp | Necessário para auditoria |
+| Interoperabilidade | practitioner_fhir_id | ✅ | "Practitioner/123" | Gerado ao publicar perfil |
+| | encounter_ids | ⚪️ | ["Encounter/1"] | Apenas leitura |
+| Segurança | papeis | ✅ | ["profissional"] | Provisionado via Auth0 |
+| | mfa_habilitado | ⚪️ | false | Exibir status |
+| | logs_auditoria | ✅ | lista | Append-only |
+| Engajamento | pacientes_conectados | ⚪️ | 12 | Card resumo |
+| | nps | ⚪️ | 68 | Campo leitura |
+
+Legenda: ✅ obrigatório no MVP | ⚪️ opcional/backlog imediato.
+
+## 2. Regras de Negócio & Fluxos
+### Pré-condições
+- Profissional deve completar cadastro pessoal e de credenciais e aceitar termos LGPD/HIPAA.
+- API de verificação de conselho configurada (mockável para demonstração).
+- Plano selecionado e pagamento inicial confirmado (simulado via webhook falso se necessário).
+
+### Fluxos MVP
+1. **Onboarding do Profissional**
+   - Cadastro → validação de CPF/Email → aceite de termos → escolha de plano → checkout (Stripe simulada).
+   - Pós-condição: licença `ativo`, `status_validacao` = `pendente`, perfil visível somente para admin até verificação.
+2. **Verificação de Conselho**
+   - Job assíncrono consulta API (mock) → atualiza `status_validacao` e `status_registro`.
+   - Falha mantém `status_registro = suspenso` e bloqueia publicação do perfil.
+3. **Gestão de Licença**
+   - Cron diário verifica faturas → após `dueDate + 7 dias` sem pagamento → `status_licenca = inadimplente` → bloqueio Health Wallet.
+   - Regularização do pagamento reativa automaticamente.
+4. **Consentimento Health Wallet**
+   - Profissional envia convite → paciente concede via app → API gera recurso `Consent` com escopos.
+   - Sempre validar `status_licenca = ativo` e `escopo` antes de retornar dados.
+5. **Logs de Auditoria**
+   - Toda leitura/escrita da Health Wallet gera `AuditEvent` com request_id, profissional, paciente, escopo.
+
+### Estados Principais
+- Profissional: `rascunho`, `publicado`, `bloqueado` (quando registro suspenso).
+- Licença: `ativo`, `inadimplente`.
+- Consentimento: `ativo`, `revogado`.
+
+## 3. Esquema de Dados (JSON/FHIR Mapping)
+```json
+{
+  "professionalId": "prof-001",
+  "personal": {
+    "fullName": "Dra. Ana Ribeiro",
+    "cpf": "12345678900",
+    "birthDate": "1985-06-12",
+    "email": "ana@lilu.com",
+    "phone": "+5511912345678"
+  },
+  "credentials": {
+    "council": {"type": "CRM", "number": "123456", "uf": "SP"},
+    "specialties": ["Cardiologia"],
+    "verification": {"status": "pending", "checkedAt": null}
+  },
+  "compliance": {
+    "registryStatus": "ativo",
+    "terms": {"version": "3.2", "acceptedAt": "2024-03-10T12:00:00Z", "ip": "200.10.1.2"}
+  },
+  "licensing": {
+    "plan": "mensal",
+    "amount": 249.0,
+    "status": "ativo",
+    "cycle": {"start": "2024-03-01", "end": "2024-03-31"}
+  },
+  "consents": [
+    {
+      "patientId": "patient-999",
+      "scopes": {"consultations": true, "evolutions": true},
+      "status": "ativo",
+      "grantedAt": "2024-03-15T14:22:00Z"
+    }
+  ],
+  "interoperability": {
+    "practitionerRef": "Practitioner/123",
+    "encounterRefs": ["Encounter/enc-001"]
+  },
+  "security": {
+    "roles": ["professional"],
+    "mfa": false
+  }
+}
+```
+
+**Mapeamento FHIR MVP**
+- `Practitioner.identifier` ← CPF, `Practitioner.qualification` ← conselho/UF/número.
+- `Practitioner.active` reflete `status_registro` (false se suspenso).
+- `Consent` para health wallet com `scope` limitado a `encounter` e `condition` (`Observation`).
+- `Encounter`/`Observation`/`DocumentReference` expostos somente em leitura.
+
+**Pseudo-SQL**
+```sql
+CREATE TABLE professionals (
+  id UUID PRIMARY KEY,
+  full_name VARCHAR(150) NOT NULL,
+  cpf CHAR(11) UNIQUE NOT NULL,
+  birth_date DATE NOT NULL,
+  email VARCHAR(150) NOT NULL,
+  phone VARCHAR(20) NOT NULL,
+  council_type VARCHAR(20) NOT NULL,
+  council_number VARCHAR(30) NOT NULL,
+  council_uf CHAR(2) NOT NULL,
+  specialties TEXT[] NOT NULL,
+  registry_status VARCHAR(20) DEFAULT 'rascunho',
+  terms JSONB NOT NULL,
+  practitioner_fhir_id VARCHAR(80),
+  created_at TIMESTAMP DEFAULT NOW(),
+  updated_at TIMESTAMP DEFAULT NOW()
+);
+
+CREATE TABLE licenses (
+  id UUID PRIMARY KEY,
+  professional_id UUID REFERENCES professionals(id),
+  plan VARCHAR(10) NOT NULL,
+  amount NUMERIC(10,2) NOT NULL,
+  status VARCHAR(20) NOT NULL,
+  cycle_start DATE NOT NULL,
+  cycle_end DATE NOT NULL,
+  auto_renew BOOLEAN DEFAULT FALSE,
+  billing_history JSONB DEFAULT '[]'::JSONB,
+  updated_at TIMESTAMP DEFAULT NOW()
+);
+
+CREATE TABLE consents (
+  id UUID PRIMARY KEY,
+  professional_id UUID REFERENCES professionals(id),
+  patient_cpf CHAR(11) NOT NULL,
+  scopes JSONB NOT NULL,
+  status VARCHAR(20) NOT NULL,
+  granted_at TIMESTAMP NOT NULL,
+  revoked_at TIMESTAMP
+);
+
+CREATE TABLE audit_logs (
+  id UUID PRIMARY KEY,
+  professional_id UUID REFERENCES professionals(id),
+  action VARCHAR(50) NOT NULL,
+  resource VARCHAR(100) NOT NULL,
+  outcome VARCHAR(20) NOT NULL,
+  request_id UUID NOT NULL,
+  ip_address INET,
+  created_at TIMESTAMP DEFAULT NOW()
+);
+```
+
+## 4. Critérios de Aceite (MVP)
+- Cadastro do profissional armazena e exibe todos os campos marcados como obrigatórios com validação automática.
+- Perfil não muda para `publicado` enquanto o conselho não estiver `verificado`.
+- Licença `ativo` é pré-requisito para listar dados da Health Wallet; chamadas sem licença respondem `403` com motivo claro.
+- Consentimentos registram escopos e timestamps; revogação bloqueia acesso imediatamente.
+- Logs de auditoria registram 100% das operações de leitura/escrita da wallet com request_id rastreável.
+- Endpoints FHIR respondem bundle com Practitioner + Encounter/Observation de exemplo para demonstração.
+- Interface exibe badges de estado (ativo/inadimplente/suspenso) com chamadas para ação (regularizar, reenviar documentos).
+- Segurança básica: TLS ativo, MFA opcional disponível, senhas armazenadas fora do escopo (delegadas ao Auth0).
+
+## 5. Roteiro de Telas (Wireframe Descritivo MVP)
+1. **Login/Auth**
+   - Logotipo Lilu, campos e-mail/senha, botão "Entrar".
+   - Link "Ativar MFA" (abre modal de configuração via Auth0).
+2. **Dashboard**
+   - Header com foto/nome/status_registro.
+   - Cards: Licença (status, próximo vencimento), Consentimentos ativos, Último acesso.
+   - Alertas: "Verificação CRM pendente", "Licença inadimplente".
+3. **Perfil Profissional**
+   - Aba "Dados pessoais": formulário (nome, cpf readonly após salvar, nascimento, contato, endereço).
+   - Aba "Credenciais": conselho/UF/nº, especialidades (chips), upload certificado.
+   - Estado de verificação (badge + data da última checagem).
+4. **Licenciamento Lilu**
+   - Painel com plano atual, valor, status, ciclo vigente.
+   - Tabela minimalista de faturas (nº, vencimento, status) e botão "Pagar agora" (redireciona para checkout Stripe/teste).
+5. **Health Wallet & Consentimentos**
+   - Lista de pacientes com status do consentimento (chips por escopo).
+   - Botão "Solicitar consentimento" → modal para enviar convite.
+   - Acesso ao histórico (logs) com request_id e data.
+6. **Interoperabilidade**
+   - Seção com IDs FHIR ativos, botão "Baixar FHIR Bundle" (json exemplo).
+7. **Segurança & Auditoria**
+   - Toggle MFA (read-only se configurado no Auth0), botão "Ver logs recentes" (abre drawer com tabela).
+
+## Plano de Execução e Publicação
+### Sprint 0 – Fundamentos (1 semana)
+- Configurar repositórios (front/back), CI/CD (Vercel + Render).
+- Provisionar PostgreSQL e variáveis secretas (Auth0, Stripe mock, Storage S3).
+- Definir design system leve (Tailwind + componentes básicos).
+
+### Sprint 1 – Onboarding & Cadastro (1 semana)
+- Implementar formulários de dados pessoais e credenciais com validações.
+- Implementar API CRUD `POST/GET /professionals`.
+- Integração Auth0 + roles.
+
+### Sprint 2 – Licenciamento & Pagamentos (1 semana)
+- Criar modelo de licença + faturas.
+- Fluxo de pagamento com Stripe test + atualização de status.
+- Bloqueio automático da Health Wallet quando inadimplente.
+
+### Sprint 3 – Health Wallet & Consentimentos (1 semana)
+- CRUD consentimentos, convites mockados por e-mail.
+- Integração leitura de encontros/observações mock (seed de dados por paciente).
+- Gerar e exibir logs de auditoria.
+
+### Sprint 4 – Interoperabilidade & Hardening (1 semana)
+- Expor endpoints FHIR `GET /fhir/Practitioner/:id`, `GET /fhir/Bundle/:professionalId`.
+- Implementar exportação JSON/CSV e relatório PDF simples.
+- Revisão segurança (TLS, MFA opcional, backups, monitoramento).
+
+### Go-Live Piloto
+- Deploy para ambiente de produção (domínio `mvp.lilu.com`).
+- Criar 5 contas piloto + 10 pacientes fictícios.
+- Preparar demo script com casos: onboarding completo, bloqueio por inadimplência, consulta FHIR.
+
+## Backlog Pós-MVP
+- Estados adicionais de licença (`cancelado`), escalonamento de cobrança automático.
+- Consentimentos granulares por tipo (prescrição, exames) e revogação parcial.
+- Dashboards de engajamento com NPS e feedbacks reais.
+- MFA obrigatório para papéis sensíveis e gestão de sessões ativas.
+- Integrações reais com conselhos e operadoras.
+
+## Métricas-Chave para Apresentação
+- Nº profissionais cadastrados, taxa de verificação automatizada, tempo médio de ativação.
+- Health Wallet: nº consentimentos ativos, consultas registradas.
+- Financeiro: receita recorrente mensal (MRR) estimada com base nos planos do piloto.
+- Confiabilidade: uptime (target 99,5%), latência média API (<300ms), eventos auditados 100%.
+
 
EOF
)
