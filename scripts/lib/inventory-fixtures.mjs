/** Synthetic stock for local PGlite integration tests only. Never run against a hosted database. */
export async function availableInventory(db, quantity=10000) {
 const columns=(await db.query("select 1 from information_schema.columns where table_name='lots' and column_name='inventory_id'")).rows;
 if(!columns.length){await db.query('update products set stock=$1',[quantity]);return;}
 await db.exec("insert into storage.objects(bucket_id,name) select 'certificates',lot||'.pdf' from products on conflict do nothing");
 await db.query(`update lots l set units=$1, received_units=$1, expected_units=$1, received_at='2026-09-01T12:00:00Z',
 status='released', testing_status='passed', reference='SYNTHETIC-TEST', tested_at='2026-09-01', coa_path=l.lot||'.pdf',
 results='[{"label":"Purity","method":"HPLC","value":"99.5","unit":"%"},{"label":"Identity","method":"Mass spectrometry","value":"Confirmed","unit":""}]'
 where l.lot in(select lot from products)`,[quantity]);
}
