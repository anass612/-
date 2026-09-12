-- ============================================================================
-- تفعيل شاشة التجميع (Assembly) — كانت فاضية لأن asset_models/product_definitions
-- ما فيها ولا صف. القرار (بالتنسيق مع أنس): O-NA يتتبّع فردياً بالسريال وقت
-- التجميع (فيه أصلاً 464 لوحة مسجّلة، 86 منها بالمستودع) — القطع bulk (كيس،
-- كيبل...) ما نضيفها هنا لأنه ما عندنا أرقام BOM حقيقية مؤكدة بعد؛ الشاشة
-- تشتغل بدونها (bulk BOM فاضي مقبول)، وتُضاف لاحقاً بسطر واحد لما تتأكد الكمية.
-- ============================================================================

insert into asset_models (model_name, category, notes)
values ('O-NA', 'compute_board', 'اللوحة الأساسية (RES) — تتبع فردي بالسريال، مستوردة من Airtable أصلاً كـ 464 Asset فردي');

update assets set asset_model_id = (select id from asset_models where model_name = 'O-NA')
where asset_type = 'O-NA';

insert into product_definitions (product_name, product_type, notes)
values ('RIME Brain V2', 'main_device', 'مسودة أولية — أضف بنود BOM bulk (كيس، كيبل طاقة...) لما تتأكد الكميات الحقيقية');

insert into product_required_asset_models (product_id, asset_model_id, role_label)
select p.id, m.id, 'O-NA'
from product_definitions p, asset_models m
where p.product_name = 'RIME Brain V2' and m.model_name = 'O-NA';
