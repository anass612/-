-- حفظ فاتورة شراء بعملية واحدة ذرية (شاشة 10 بتصميم RIME) — قسم 2.8.7 بالمواصفة
-- القطع/المستهلكات bulk تزيد كميتها، والأصول المُسريلة تُنشأ كسطور Asset مستقلة
create or replace function fn_save_purchase_invoice(
  p_supplier_name text,
  p_invoice_number text,
  p_invoice_date date,
  p_shipping_cost numeric,
  p_created_by uuid,
  p_line_items jsonb -- [{type:'component'|'consumable'|'asset_model', ref_id, quantity, unit_price, manufacturer_serial_number?, asset_type?}]
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_invoice_id uuid;
  v_line jsonb;
  v_line_total numeric(12,2) := 0;
  v_total numeric(12,2) := 0;
  v_new_serial text;
begin
  if not fn_is_staff() then
    raise exception 'insufficient_privilege: staff only';
  end if;

  for v_line in select * from jsonb_array_elements(p_line_items) loop
    v_total := v_total + ((v_line->>'quantity')::numeric * (v_line->>'unit_price')::numeric);
  end loop;
  v_total := v_total + p_shipping_cost;

  insert into purchase_invoices (supplier_name, invoice_number, invoice_date, shipping_cost, total_cost, created_by)
  values (p_supplier_name, p_invoice_number, p_invoice_date, p_shipping_cost, v_total, p_created_by)
  returning id into v_invoice_id;

  for v_line in select * from jsonb_array_elements(p_line_items) loop
    v_line_total := (v_line->>'quantity')::numeric * (v_line->>'unit_price')::numeric;

    if v_line->>'type' = 'component' then
      insert into purchase_invoice_line_items (invoice_id, component_id, quantity, unit_cost)
      values (v_invoice_id, (v_line->>'ref_id')::uuid, (v_line->>'quantity')::int, (v_line->>'unit_price')::numeric);
      update components set quantity_on_hand = quantity_on_hand + (v_line->>'quantity')::int, unit_cost = (v_line->>'unit_price')::numeric
      where id = (v_line->>'ref_id')::uuid;

    elsif v_line->>'type' = 'consumable' then
      insert into purchase_invoice_line_items (invoice_id, consumable_id, quantity, unit_cost)
      values (v_invoice_id, (v_line->>'ref_id')::uuid, (v_line->>'quantity')::int, (v_line->>'unit_price')::numeric);
      update consumables set quantity_on_hand = quantity_on_hand + (v_line->>'quantity')::int, unit_cost = (v_line->>'unit_price')::numeric
      where id = (v_line->>'ref_id')::uuid;

    elsif v_line->>'type' = 'asset_model' then
      insert into purchase_invoice_line_items (invoice_id, asset_model_id, quantity, unit_cost)
      values (v_invoice_id, (v_line->>'ref_id')::uuid, 1, (v_line->>'unit_price')::numeric);

      v_new_serial := 'SN-' || replace(gen_random_uuid()::text, '-', '');
      insert into assets (serial_number, manufacturer_serial_number, asset_model_id, asset_type, purchase_date, purchase_cost, current_status)
      values (
        substr(v_new_serial, 1, 12),
        nullif(v_line->>'manufacturer_serial_number', ''),
        (v_line->>'ref_id')::uuid,
        coalesce(v_line->>'asset_type', 'component'),
        p_invoice_date,
        (v_line->>'unit_price')::numeric,
        'in_warehouse'
      );
    end if;
  end loop;

  return v_invoice_id;
end;
$$;

revoke execute on function fn_save_purchase_invoice(text, text, date, numeric, uuid, jsonb) from public, anon;
grant execute on function fn_save_purchase_invoice(text, text, date, numeric, uuid, jsonb) to authenticated;
