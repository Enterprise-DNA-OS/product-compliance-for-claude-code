-- The rules and the substances they name: reference data every install needs.
-- Check the live lists before you rely on them; docs/compliance.md has the sources.
-- Change them with /customise (a new numbered migration), never by editing an applied one.

insert into regulations(code,name,markets,scope,validity_months,follows_candidate_list,source) values
 ('EU-ROHS','RoHS: restricted substances in electrical equipment',array['EU','UK'],'part',null,false,'Directive 2011/65/EU Annex II as amended by Delegated Directive (EU) 2015/863; UK RoHS Regulations 2012'),
 ('REACH-SVHC','REACH: Candidate List substances in articles',array['EU'],'part',null,true,'Regulation (EC) No 1907/2006 Article 33; Directive 2008/98/EC Article 9(1)(i) for SCIP'),
 ('PROP65','California Proposition 65 warnings',array['US-CA'],'part',null,false,'California Health and Safety Code section 25249.6'),
 ('CONFLICT-MINERALS','Conflict minerals (tin, tantalum, tungsten, gold)',array['EU','US'],'supplier',12,false,'Customer requests under Dodd-Frank Act section 1502 (SEC Rule 13p-1) and Regulation (EU) 2017/821, answered with the RMI Conflict Minerals Reporting Template')
on conflict (code) do nothing;

insert into substances(name,cas,rohs_limit_ppm,svhc_added,prop65,source) values
 ('Lead','7439-92-1',1000,'2018-06-27',true,'RoHS Annex II; ECHA Candidate List; OEHHA Proposition 65 list'),
 ('Mercury','7439-97-6',1000,null,true,'RoHS Annex II; OEHHA Proposition 65 list'),
 ('Cadmium','7440-43-9',100,'2013-06-20',true,'RoHS Annex II; ECHA Candidate List; OEHHA Proposition 65 list'),
 ('Hexavalent chromium','18540-29-9',1000,null,true,'RoHS Annex II; OEHHA Proposition 65 list'),
 ('Polybrominated biphenyls (PBB)',null,1000,null,false,'RoHS Annex II'),
 ('Polybrominated diphenyl ethers (PBDE)',null,1000,null,false,'RoHS Annex II'),
 ('DEHP','117-81-7',1000,'2008-10-28',true,'RoHS Annex II; ECHA Candidate List; OEHHA Proposition 65 list'),
 ('BBP','85-68-7',1000,'2008-10-28',false,'RoHS Annex II; ECHA Candidate List'),
 ('DBP','84-74-2',1000,'2008-10-28',false,'RoHS Annex II; ECHA Candidate List'),
 ('DIBP','84-69-5',1000,'2010-01-13',false,'RoHS Annex II; ECHA Candidate List'),
 ('Bisphenol A','80-05-7',null,'2017-01-12',true,'ECHA Candidate List; OEHHA Proposition 65 list'),
 ('Medium-chain chlorinated paraffins','85535-85-9',null,'2021-07-08',false,'ECHA Candidate List')
on conflict (name) do nothing;
