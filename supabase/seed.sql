-- Demo data: a fictional Auckland maker of outdoor lighting that sells into Europe, the UK, the US and home.
-- Every date is relative to today so the demo always has something overdue, stale and expiring.
-- A second run does nothing.
do $$
declare
  s_luma uuid; s_drvr uuid; s_aluc uuid; s_cabl uuid; s_pcba uuid; s_fast uuid;
  fl uuid; bl uuid; ct uuid;
  d uuid;
begin
  if exists (select 1 from suppliers where code = 'LUMA') then return; end if;

  insert into settings(key,value,note) values
   ('candidate_list_updated',(current_date - 120)::text,'Date of the last ECHA Candidate List update. REACH declarations older than this are stale.'),
   ('company','Kahu Outdoor Lighting Ltd (demo)','Name used on certificates');

  insert into suppliers(code,name,contact_name,contact_email,country,supplies_3tg) values
   ('LUMA','Luma Optoelectronics','Grace Lin','compliance@luma.example','China',true) returning id into s_luma;
  insert into suppliers(code,name,contact_name,contact_email,country,supplies_3tg) values
   ('DRVR','Formosa Drivers Co','Kevin Wu','quality@formosadrivers.example','Taiwan',true) returning id into s_drvr;
  insert into suppliers(code,name,contact_name,contact_email,country,supplies_3tg) values
   ('ALUC','Ranui Castings','Mere Tane','office@ranuicastings.example','New Zealand',false) returning id into s_aluc;
  insert into suppliers(code,name,contact_name,contact_email,country,supplies_3tg) values
   ('CABL','Southern Cable and Gland','Josh Patel','sales@southerncable.example','Australia',false) returning id into s_cabl;
  insert into suppliers(code,name,contact_name,contact_email,country,supplies_3tg) values
   ('PCBA','Penang Board Assembly','Aisha Rahman','qa@penangboard.example','Malaysia',true) returning id into s_pcba;
  insert into suppliers(code,name,contact_name,contact_email,country,supplies_3tg) values
   ('FAST','Onehunga Fasteners','Dave Smith','dave@onehungafasteners.example','New Zealand',false) returning id into s_fast;

  insert into parts(part_no,description,supplier_id,mfr_part_no,category,mass_g) values
   ('P-1001','LED module 200 W',s_luma,'LM-200-57K','LED',180),
   ('P-1002','LED module 40 W',s_luma,'LM-040-30K','LED',45),
   ('P-2001','Constant current driver 200 W',s_drvr,'FD-200-IP67','Driver',650),
   ('P-2002','Constant current driver 40 W',s_drvr,'FD-040-IP67','Driver',210),
   ('P-3001','Floodlight housing, die-cast',s_aluc,'RC-FL200','Housing',2400),
   ('P-3002','Bollard body, extruded',s_aluc,'RC-BL900','Housing',3100),
   ('P-4001','Power cable 3-core 1 m',s_cabl,'SCG-3C-1000','Cable',120),
   ('P-4002','Cable gland M20, PVC seal',s_cabl,'SCG-M20-PVC','Cable',18),
   ('P-5001','Controller board assembly',s_pcba,'PBA-CTRL-R3','Electronics',95),
   ('P-5002','Controller enclosure, polycarbonate',s_pcba,'PBA-ENC-01','Housing',260),
   ('P-6001','Brass cable fitting',s_fast,'OF-BR-M20','Fitting',35),
   ('P-6002','Stainless screw kit',s_fast,'OF-SS-KIT8','Fastener',22),
   ('P-7001','Surge protector 10 kV',s_drvr,'FD-SPD-10','Electronics',40);

  insert into products(code,name,markets,owner) values ('FL-200','Floodlight 200 W',array['EU','UK','US-CA','AU','NZ'],'Hana Walker') returning id into fl;
  insert into products(code,name,markets,owner) values ('BL-40','Bollard light 40 W',array['EU','AU','NZ'],'Hana Walker') returning id into bl;
  insert into products(code,name,markets,scip_ref,owner) values ('CTRL-1','Lighting controller',array['EU','US','US-CA','AU'],'7e1c5a2b-demo-scip','Sam Ruawai') returning id into ct;

  insert into bom(product_id,part_id,qty) select fl, id, 1 from parts where part_no in ('P-1001','P-2001','P-3001','P-4001','P-4002','P-6002','P-7001');
  insert into bom(product_id,part_id,qty) select bl, id, 1 from parts where part_no in ('P-1002','P-2002','P-3002','P-4001','P-6001','P-6002');
  insert into bom(product_id,part_id,qty) select ct, id, 1 from parts where part_no in ('P-5001','P-5002','P-6001','P-6002');

  -- RoHS
  insert into declarations(part_id,regulation,status,received_on,valid_until,document_ref,actor)
   select id,'EU-ROHS','compliant',current_date-200,null,'LUMA-RoHS-2026.pdf','Hana Walker' from parts where part_no in ('P-1001','P-1002');
  insert into declarations(part_id,regulation,status,received_on,valid_until,document_ref,actor)
   select id,'EU-ROHS','compliant',current_date-90,current_date+640,'FD-RoHS-200.pdf','Hana Walker' from parts where part_no = 'P-2001';
  insert into declarations(part_id,regulation,status,received_on,valid_until,document_ref,actor)
   select id,'EU-ROHS','compliant',current_date-740,current_date-10,'FD-RoHS-040.pdf','Hana Walker' from parts where part_no = 'P-2002';
  insert into declarations(part_id,regulation,status,received_on,document_ref,actor)
   select id,'EU-ROHS','compliant',current_date-150,'Ranui-material-cert.pdf','Hana Walker' from parts where part_no in ('P-3001','P-3002');
  insert into declarations(part_id,regulation,status,received_on,document_ref,actor)
   select id,'EU-ROHS','compliant',current_date-60,'SCG-RoHS-cable.pdf','Hana Walker' from parts where part_no = 'P-4001';
  insert into declarations(part_id,regulation,status,received_on,document_ref,source,actor)
   select id,'EU-ROHS','non_compliant',current_date-25,'Lab report AKL-25-1187','lab_test','Hana Walker' from parts where part_no = 'P-4002' returning id into d;
  insert into declaration_substances(declaration_id,substance_id,concentration_ppm,location) select d, id, 2500, 'PVC sealing ring' from substances where name = 'DEHP';
  insert into declarations(part_id,regulation,status,exemption,exemption_expires,received_on,document_ref,actor)
   select id,'EU-ROHS','compliant_exemption','Annex III 7(a): lead in high melting temperature solder',current_date+120,current_date-80,'PBA-RoHS-R3.pdf','Sam Ruawai' from parts where part_no = 'P-5001';
  insert into declarations(part_id,regulation,status,received_on,document_ref,actor)
   select id,'EU-ROHS','compliant',current_date-80,'PBA-RoHS-ENC.pdf','Sam Ruawai' from parts where part_no = 'P-5002';
  insert into declarations(part_id,regulation,status,exemption,exemption_expires,received_on,document_ref,actor)
   select id,'EU-ROHS','compliant_exemption','Annex III 6(c): copper alloy containing up to 4% lead',current_date+900,current_date-70,'OF-brass-decl.pdf','Hana Walker' from parts where part_no = 'P-6001';
  insert into declarations(part_id,regulation,status,received_on,document_ref,actor)
   select id,'EU-ROHS','compliant',current_date-70,'OF-ss-decl.pdf','Hana Walker' from parts where part_no = 'P-6002';

  -- REACH: P-1001 and P-1002 were declared before the last Candidate List update, so they are stale.
  insert into declarations(part_id,regulation,status,received_on,document_ref,actor)
   select id,'REACH-SVHC','compliant',current_date-300,'LUMA-REACH-2025.pdf','Hana Walker' from parts where part_no in ('P-1001','P-1002');
  insert into declarations(part_id,regulation,status,received_on,document_ref,actor)
   select id,'REACH-SVHC','compliant',current_date-90,'FD-REACH.pdf','Hana Walker' from parts where part_no in ('P-2001','P-2002');
  insert into declarations(part_id,regulation,status,received_on,document_ref,actor)
   select id,'REACH-SVHC','compliant',current_date-100,'Ranui-REACH.pdf','Hana Walker' from parts where part_no in ('P-3001','P-3002');
  insert into declarations(part_id,regulation,status,received_on,document_ref,actor)
   select id,'REACH-SVHC','compliant',current_date-60,'SCG-REACH.pdf','Hana Walker' from parts where part_no in ('P-4001','P-4002');
  insert into declarations(part_id,regulation,status,received_on,document_ref,actor)
   select id,'REACH-SVHC','compliant',current_date-80,'PBA-REACH.pdf','Sam Ruawai' from parts where part_no in ('P-5001','P-5002');
  insert into declarations(part_id,regulation,status,received_on,document_ref,actor)
   select id,'REACH-SVHC','contains_listed',current_date-70,'OF-REACH-brass.pdf','Hana Walker' from parts where part_no = 'P-6001' returning id into d;
  insert into declaration_substances(declaration_id,substance_id,concentration_ppm,location) select d, id, 25000, 'brass body' from substances where name = 'Lead';
  insert into declarations(part_id,regulation,status,received_on,document_ref,actor)
   select id,'REACH-SVHC','compliant',current_date-70,'OF-REACH-ss.pdf','Hana Walker' from parts where part_no = 'P-6002';

  -- Proposition 65 (FL-200 and CTRL-1 sell into California)
  insert into declarations(part_id,regulation,status,received_on,document_ref,actor)
   select id,'PROP65','compliant',current_date-90,'Prop65-supplier-letters.pdf','Hana Walker' from parts where part_no in ('P-1001','P-2001','P-3001','P-4001','P-6002','P-5001','P-5002');
  insert into declarations(part_id,regulation,status,received_on,document_ref,source,actor)
   select id,'PROP65','contains_listed',current_date-25,'Lab report AKL-25-1187','lab_test','Hana Walker' from parts where part_no = 'P-4002' returning id into d;
  insert into declaration_substances(declaration_id,substance_id,concentration_ppm,location) select d, id, 2500, 'PVC sealing ring' from substances where name = 'DEHP';
  insert into declarations(part_id,regulation,status,received_on,document_ref,actor)
   select id,'PROP65','contains_listed',current_date-70,'OF-brass-decl.pdf','Hana Walker' from parts where part_no = 'P-6001' returning id into d;
  insert into declaration_substances(declaration_id,substance_id,concentration_ppm,location) select d, id, 25000, 'brass body' from substances where name = 'Lead';

  -- One supplier letter was never filed: the record checks pick it up.
  update declarations set document_ref = null where regulation = 'PROP65' and part_id = (select id from parts where part_no = 'P-6002');

  -- Conflict minerals templates
  insert into cmrts(supplier_id,template_version,received_on,smelters_reported,smelters_conformant,smelters_not_conformant,document_ref,actor) values
   (s_luma,'6.5',current_date-100,42,42,0,'LUMA-CMRT.xlsx','Hana Walker'),
   (s_drvr,'6.4',current_date-400,37,35,0,'FD-CMRT-old.xlsx','Hana Walker'),
   (s_pcba,'6.5',current_date-50,58,54,2,'PBA-CMRT.xlsx','Sam Ruawai');

  -- Requests out to suppliers and in from customers
  insert into supplier_requests(supplier_id,regulation,part_nos,sent_on,due_on,reminders,last_reminder,status,actor) values
   (s_drvr,'EU-ROHS',array['P-2002','P-7001'],current_date-30,current_date-9,1,current_date-5,'open','Hana Walker'),
   (s_drvr,'CONFLICT-MINERALS',array[]::text[],current_date-20,current_date-6,0,null,'open','Hana Walker'),
   (s_fast,'REACH-SVHC',array['P-6001'],current_date-4,current_date+17,0,null,'open','Hana Walker');
  insert into supplier_requests(supplier_id,regulation,part_nos,sent_on,due_on,status,outcome,actor) values
   (s_cabl,'REACH-SVHC',array['P-4001','P-4002'],current_date-75,current_date-61,'answered','Declarations received','Hana Walker');

  insert into customer_requests(customer,product_id,regulation,received_on,due_on,actor) values
   ('Nordlicht Grosshandel GmbH',bl,'REACH-SVHC',current_date-6,current_date+5,'Hana Walker'),
   ('Bay Area Site Lighting',fl,'PROP65',current_date-3,current_date+20,'Hana Walker');

  insert into certificates(product_id,regulation,issued_to,issued_on,status_at_issue,actor) values
   (ct,'EU-ROHS','Nordlicht Grosshandel GmbH',current_date-40,'compliant_exemption','Sam Ruawai');
end $$;
