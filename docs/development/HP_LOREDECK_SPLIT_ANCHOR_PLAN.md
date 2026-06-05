# Harry Potter Loredeck Split and High-Granularity Anchor Plan

## Purpose

The current bundled `hp-golden-trio` Loredeck is too broad for Saga's long-term Context model. It covers all seven Golden Trio years, but its first-class `timeline.json` is sparse: 17 anchors and 3 windows across the entire era. The deck also contains year-specific calendar Lorecards, but those are not enough for the Context Browser to support precise "after X, before Y" selection.

Saga should replace the monolithic deck with a Harry Potter Golden Trio deck family:

- `hp-core`
- `hp-year-1-philosophers-stone`
- `hp-year-2-chamber-of-secrets`
- `hp-year-3-prisoner-of-azkaban`
- `hp-year-4-goblet-of-fire`
- `hp-year-5-order-of-the-phoenix`
- `hp-year-6-half-blood-prince`
- `hp-year-7-deathly-hallows`

Year 7 should remain one Loredeck, but it should have internal phase windows for the Seven Potters, Horcrux hunt, Ministry infiltration, camping, Godric's Hollow, Hallows/Malfoy Manor, Shell Cottage, Gringotts, Hogwarts return, and Battle of Hogwarts.

## Anchor Philosophy

Highest-granularity Saga Loredecks need a dense Context spine. Lorecards can be numerous, but the user needs a smaller, navigable set of durable waypoints for choosing story position.

For each year deck:

- Use first-class timeline anchors for events users are likely to say "before", "after", or "during".
- Use windows for major playable spans: summer, arrival, fall term, holiday, spring term, climax, aftermath.
- Allow ad hoc windows in the Context Browser by selecting any two anchors as `after` and `before`.
- Do not manually create every possible pairwise window.
- Keep IDs stable and story-readable.
- Put exact dates in coordinates when known, but do not make IDs date-dependent.
- Mark uncertain dates with approximate coordinate metadata rather than forcing false precision.

Recommended anchor density:

- Core: 20-35 recurring-cycle or global utility anchors.
- Year 1-3: 35-50 story anchors each.
- Year 4-6: 45-65 story anchors each.
- Year 7: 60-80 story anchors because the story is event-dense and not school-year-routine.

Recommended ID style:

```text
hp.core.school_cycle.christmas_break
hp.y6.slughorn_christmas_party
hp.y6.post_christmas_return
hp.y6.apparition_lessons_begin
hp.y6.susan_bones_splinched
```

The Context Browser should display friendly labels, not IDs.

## Core Loredeck

`hp-core` should not be a hidden miniature monolith. It should provide cross-year reusable scaffolding only.

Core entries should cover:

- Hogwarts institution baseline.
- Houses, points, prefects, Head Boy/Girl, detentions, exams, common rooms, staff roles.
- Magical Britain public/private institutions.
- Statute of Secrecy and Muggle/Wizard divide.
- Ministry, Wizengamot, Aurors, Azkaban, St Mungo's.
- Diagon Alley, Knockturn Alley, Gringotts, Hogsmeade, King's Cross.
- Owls, floo, Portkeys, Apparition rules, broom travel, Hogwarts Express.
- Magic education progression and underage magic rules.
- Wandlore basics and spellcasting constraints.
- Quidditch baseline.
- Pure-blood social norms, blood prejudice, family names, old money.
- General magical creatures, ghosts, portraits, house-elves, goblins.

Core should avoid:

- Year-specific reveals.
- Character phase states that change by year.
- Death states.
- Voldemort-return public knowledge.
- Dumbledore mission details.
- Horcruxes.
- Any "future canon" state.

Core timeline anchors should be recurring-cycle waypoints, not story-spoiler waypoints:

| Anchor ID | Label | Purpose |
| --- | --- | --- |
| `hp.core.school_cycle.summer_break` | Summer break | Seasonal baseline for home/away-from-school scenes. |
| `hp.core.school_cycle.supply_shopping` | School supply shopping | Diagon Alley, booklists, robes, wands, cauldrons, pets. |
| `hp.core.school_cycle.hogwarts_express` | Hogwarts Express travel | Train scenes, compartments, trolley, platform. |
| `hp.core.school_cycle.sorting_feast` | Start-of-term feast | Sorting, staff table, first-night expectations. |
| `hp.core.school_cycle.first_week` | First week of term | Class schedules, social sorting, early rumors. |
| `hp.core.school_cycle.halloween` | Halloween at Hogwarts | Feast/tradition waypoint, not a year-specific troll anchor. |
| `hp.core.school_cycle.late_autumn` | Late autumn term | Quidditch, essays, cold weather, routine pressure. |
| `hp.core.school_cycle.christmas_break` | Christmas break | Staying at Hogwarts, going home, gifts, empty castle. |
| `hp.core.school_cycle.winter_term` | Winter term | January-February class pressure. |
| `hp.core.school_cycle.easter_break` | Easter break | Revision, family visits, spring tension. |
| `hp.core.school_cycle.exam_season` | Exam season | Revision, practical exams, academic pressure. |
| `hp.core.school_cycle.end_of_year` | End of school year | Feast, House Cup, train home. |
| `hp.core.world.diagon_alley` | Diagon Alley baseline | Non-year-specific shopping and commerce scenes. |
| `hp.core.world.hogsmeade` | Hogsmeade baseline | Village social/commerce baseline. |
| `hp.core.world.ministry` | Ministry baseline | Government offices and political authority. |
| `hp.core.world.azkaban` | Azkaban baseline | Prison/dementor institutional baseline. |
| `hp.core.world.st_mungos` | St Mungo's baseline | Magical hospital scenes. |
| `hp.core.magic.underage_magic` | Underage magic rule | General restriction before year-specific exceptions. |
| `hp.core.magic.apparition_rule` | Apparition legal rule | Legal age/licensing/training baseline. |
| `hp.core.magic.wand_ownership` | Wand ownership baseline | Basic wand allegiance without later Elder Wand spoilers. |
| `hp.core.social.blood_status` | Blood-status prejudice | Social conflict baseline. |
| `hp.core.social.house_rivalry` | House rivalry baseline | Gryffindor/Slytherin and house-culture baseline. |

Core windows:

- `hp.core.window.school_year_cycle`
- `hp.core.window.summer`
- `hp.core.window.autumn_term`
- `hp.core.window.christmas_break`
- `hp.core.window.winter_spring_term`
- `hp.core.window.exam_and_departure`

## Year 1: Philosopher's Stone

Goal: support starting before Hogwarts, during discovery of the magical world, after trio formation, during the Stone mystery, or after Voldemort/Quirrell.

Primary anchors:

- `hp.y1.dursley_baseline`
- `hp.y1.zoo_glass_incident`
- `hp.y1.cupboard_punishment`
- `hp.y1.letters_begin`
- `hp.y1.bedroom_move`
- `hp.y1.letters_escalate`
- `hp.y1.hut_on_rock`
- `hp.y1.hagrid_reveals_harry`
- `hp.y1.hagrid_explains_parents`
- `hp.y1.hagrid_delivers_hogwarts_letter`
- `hp.y1.diagon_alley_first_visit`
- `hp.y1.cauldron_and_school_supplies`
- `hp.y1.harry_meets_quirrell`
- `hp.y1.gringotts_vault_visit`
- `hp.y1.ollivander_wand`
- `hp.y1.stone_removed_from_gringotts`
- `hp.y1.platform_nine_three_quarters`
- `hp.y1.hogwarts_express_ron_meeting`
- `hp.y1.chocolate_frog_and_wizarding_world`
- `hp.y1.hermione_train_intro`
- `hp.y1.draco_train_rivalry`
- `hp.y1.arrival_and_sorting`
- `hp.y1.common_room_first_night`
- `hp.y1.class_schedule_established`
- `hp.y1.first_classes_begin`
- `hp.y1.snape_first_potions`
- `hp.y1.hermione_classroom_reputation`
- `hp.y1.malfoy_midnight_duel_challenge`
- `hp.y1.fluffy_discovery`
- `hp.y1.fluffy_trapdoor_theory`
- `hp.y1.flying_lesson`
- `hp.y1.harry_made_seeker`
- `hp.y1.nimbus_arrives`
- `hp.y1.halloween_troll`
- `hp.y1.trio_friendship_forms`
- `hp.y1.first_quidditch_match`
- `hp.y1.counterjinx_suspicion`
- `hp.y1.christmas_cloak`
- `hp.y1.mirror_of_erised_first`
- `hp.y1.dumbledore_mirror_warning`
- `hp.y1.nicolas_flamel_identified`
- `hp.y1.stone_mystery_confirmed`
- `hp.y1.norbert_hatches`
- `hp.y1.norbert_removed`
- `hp.y1.points_loss_and_detention`
- `hp.y1.forest_unicorn`
- `hp.y1.voldemort_unicorn_blood_clue`
- `hp.y1.exams_end`
- `hp.y1.trapdoor_trials_begin`
- `hp.y1.chess_trial_ron_sacrifice`
- `hp.y1.quirrell_voldemort_reveal`
- `hp.y1.stone_destroyed`
- `hp.y1.hospital_aftermath`
- `hp.y1.house_cup_shift`
- `hp.y1.train_home`

Curated windows:

- `hp.y1.window.pre_hogwarts_letters`
- `hp.y1.window.magical_world_discovery`
- `hp.y1.window.first_term_before_trio`
- `hp.y1.window.post_troll_trio`
- `hp.y1.window.stone_mystery`
- `hp.y1.window.christmas_mirror`
- `hp.y1.window.dragon_and_detention`
- `hp.y1.window.final_trials`
- `hp.y1.window.aftermath`

## Year 2: Chamber of Secrets

Goal: support pre-term Dobby/flying-car scenes, early attacks, post-Parseltongue suspicion, Polyjuice investigation, diary/Riddle discovery, and Chamber climax.

Primary anchors:

- `hp.y2.privet_drive_summer`
- `hp.y2.dobby_warning`
- `hp.y2.mason_dinner_ruined`
- `hp.y2.bars_on_window`
- `hp.y2.flying_car_rescue`
- `hp.y2.burrow_arrival`
- `hp.y2.burrow_family_baseline`
- `hp.y2.degnoming_and_weasley_home`
- `hp.y2.floo_knockturn_mishap`
- `hp.y2.borgin_burkes_draco_clue`
- `hp.y2.lockhart_signing`
- `hp.y2.lucius_malfoy_diary_plant`
- `hp.y2.platform_barrier_closed`
- `hp.y2.flying_car_to_hogwarts`
- `hp.y2.whomping_willow_crash`
- `hp.y2.filch_kwikspell_revealed`
- `hp.y2.ginny_sorted`
- `hp.y2.mandrakes_introduced`
- `hp.y2.herbology_restoration_rule`
- `hp.y2.lockhart_pixies`
- `hp.y2.basilisk_voice_first`
- `hp.y2.blood_message_first`
- `hp.y2.deathday_party`
- `hp.y2.mrs_norris_petrified`
- `hp.y2.chamber_legend_researched`
- `hp.y2.moaning_myrtle_bathroom_base`
- `hp.y2.rogue_bludger`
- `hp.y2.colin_petrified`
- `hp.y2.dueling_club`
- `hp.y2.parseltongue_exposed`
- `hp.y2.harry_suspected_heir`
- `hp.y2.polyjuice_brew_begins`
- `hp.y2.crabbe_goyle_hair_plan`
- `hp.y2.christmas_polyjuice_infiltration`
- `hp.y2.slytherin_common_room_interrogation`
- `hp.y2.hermione_cat_mishap`
- `hp.y2.diary_found`
- `hp.y2.tom_riddle_memory`
- `hp.y2.diary_possession_pressure`
- `hp.y2.hagrid_framed_memory`
- `hp.y2.valentine_dwarf_and_diary_pressure`
- `hp.y2.hermione_penelope_petrified`
- `hp.y2.dumbledore_removed`
- `hp.y2.spiders_followed`
- `hp.y2.aragog_clue`
- `hp.y2.basilisk_pipes_deduction`
- `hp.y2.ginny_taken`
- `hp.y2.lockhart_exposed`
- `hp.y2.chamber_opened`
- `hp.y2.fawkes_sorting_hat_sword`
- `hp.y2.basilisk_confrontation`
- `hp.y2.diary_destroyed`
- `hp.y2.ginny_rescued`
- `hp.y2.dobby_freed`
- `hp.y2.hagrid_returns`

Curated windows:

- `hp.y2.window.dobby_and_burrow`
- `hp.y2.window.arrival_to_first_attack`
- `hp.y2.window.chamber_suspicion`
- `hp.y2.window.parseltongue_suspicion`
- `hp.y2.window.polyjuice_investigation`
- `hp.y2.window.diary_and_riddle`
- `hp.y2.window.dumbledore_absent`
- `hp.y2.window.chamber_climax`
- `hp.y2.window.aftermath`

## Year 3: Prisoner of Azkaban

Goal: support Sirius-fugitive pressure, Dementor/Hogsmeade restrictions, Marauder Map secrecy, Patronus training, Buckbeak appeal, Shrieking Shack reveal, and Time-Turner rescue.

Primary anchors:

- `hp.y3.marge_arrives`
- `hp.y3.marge_inflated`
- `hp.y3.knight_bus`
- `hp.y3.leaky_cauldron_wait`
- `hp.y3.fudge_warning`
- `hp.y3.sirius_news_context`
- `hp.y3.diagon_alley_free_summer`
- `hp.y3.ice_cream_diagon_routine`
- `hp.y3.crookshanks_bought`
- `hp.y3.firebolt_display_seen`
- `hp.y3.dementor_train_search`
- `hp.y3.harry_hears_mother_scream`
- `hp.y3.lupin_intervenes`
- `hp.y3.arrival_dementor_rules`
- `hp.y3.divination_begins`
- `hp.y3.care_magical_creatures_first_lesson`
- `hp.y3.grim_omen_pressure`
- `hp.y3.buckbeak_injures_draco`
- `hp.y3.boggart_lesson`
- `hp.y3.lupin_withholds_harry_boggart`
- `hp.y3.snape_lupin_tension_visible`
- `hp.y3.fat_lady_attack`
- `hp.y3.security_lockdown`
- `hp.y3.sleeping_in_great_hall`
- `hp.y3.dementor_quidditch_collapse`
- `hp.y3.harry_loses_match`
- `hp.y3.marauders_map_given`
- `hp.y3.secret_hogsmeade_first`
- `hp.y3.honeydukes_passage_revealed`
- `hp.y3.three_broomsticks_sirius_story`
- `hp.y3.firebolt_arrives`
- `hp.y3.firebolt_confiscated`
- `hp.y3.hermione_crookshanks_ron_fight`
- `hp.y3.patronus_lessons_begin`
- `hp.y3.dementor_memory_training`
- `hp.y3.ron_curtains_sirius`
- `hp.y3.scabbers_disappears`
- `hp.y3.hermione_stress_time_turner_clues`
- `hp.y3.firebolt_returned`
- `hp.y3.patronus_improves`
- `hp.y3.quidditch_cup_won`
- `hp.y3.buckbeak_execution_notice`
- `hp.y3.divination_exam_prophecy`
- `hp.y3.scabbers_revealed_alive`
- `hp.y3.shrieking_shack_reveal`
- `hp.y3.pettigrew_exposed`
- `hp.y3.sirius_offers_harry_home`
- `hp.y3.lupin_werewolf_transformation`
- `hp.y3.lake_dementors`
- `hp.y3.harry_casts_full_patronus`
- `hp.y3.time_turner_revealed`
- `hp.y3.buckbeak_saved`
- `hp.y3.sirius_escapes`
- `hp.y3.lupin_resigns`
- `hp.y3.firebolt_gift_from_sirius`

Curated windows:

- `hp.y3.window.pre_hogwarts_fugitive_summer`
- `hp.y3.window.dementor_security`
- `hp.y3.window.hogsmeade_restricted`
- `hp.y3.window.map_and_secret_hogsmeade`
- `hp.y3.window.patronus_training`
- `hp.y3.window.buckbeak_appeal`
- `hp.y3.window.shrieking_shack_night`
- `hp.y3.window.time_turner_rescue`
- `hp.y3.window.aftermath`

## Year 4: Goblet of Fire

Goal: support World Cup, tournament selection, each task, Yule Ball fallout, Crouch mystery, graveyard return, and Voldemort's public-secret return.

Primary anchors:

- `hp.y4.frank_bryce_murder`
- `hp.y4.harry_voldemort_dream`
- `hp.y4.weasley_world_cup_pickup`
- `hp.y4.world_cup_campsite`
- `hp.y4.winky_crouch_house_elf_pressure`
- `hp.y4.world_cup_final`
- `hp.y4.death_eater_riot`
- `hp.y4.dark_mark_cast`
- `hp.y4.winky_accused`
- `hp.y4.real_moody_kidnapped`
- `hp.y4.term_arrival_tournament_announced`
- `hp.y4.age_line_announced`
- `hp.y4.weasley_twins_age_line_attempt`
- `hp.y4.moody_unforgivables_lesson`
- `hp.y4.neville_cruciatus_reaction`
- `hp.y4.summoning_charms_training`
- `hp.y4.beauxbatons_durmstrang_arrive`
- `hp.y4.gobletof_fire_entries`
- `hp.y4.harry_selected_fourth_champion`
- `hp.y4.champion_contract_pressure`
- `hp.y4.school_hostility_badges`
- `hp.y4.ron_harry_fallout_begins`
- `hp.y4.wand_weighing`
- `hp.y4.rita_skeeter_harry_profile`
- `hp.y4.dragons_revealed`
- `hp.y4.hermione_supports_harry`
- `hp.y4.sirius_fire_advice`
- `hp.y4.first_task_dragon`
- `hp.y4.ron_harry_reconcile`
- `hp.y4.yule_ball_partner_pressure`
- `hp.y4.yule_ball`
- `hp.y4.hermione_krum_reveal`
- `hp.y4.yule_ball_social_fallout`
- `hp.y4.egg_clue_bath`
- `hp.y4.moody_guides_harry_to_gillyweed`
- `hp.y4.second_task_hostages_taken`
- `hp.y4.second_task_lake`
- `hp.y4.barty_crouch_sr_missing_pressure`
- `hp.y4.karkaroff_snape_suspicion`
- `hp.y4.sirius_cave_meeting`
- `hp.y4.pensieve_crouch_trial`
- `hp.y4.bagman_goblin_debt_pressure`
- `hp.y4.crouch_sr_appears`
- `hp.y4.crouch_sr_disappears`
- `hp.y4.third_task_maze_begins`
- `hp.y4.maze_imperius_krum`
- `hp.y4.maze_acromantula`
- `hp.y4.portkey_graveyard`
- `hp.y4.cedric_killed`
- `hp.y4.voldemort_reborn`
- `hp.y4.priori_incantatem_escape`
- `hp.y4.fake_moody_revealed`
- `hp.y4.barty_crouch_jr_confession`
- `hp.y4.ministry_denial_begins`
- `hp.y4.dumbledore_reactivates_order`
- `hp.y4.train_home_after_cedric`

Curated windows:

- `hp.y4.window.world_cup`
- `hp.y4.window.pre_selection_school`
- `hp.y4.window.fourth_champion_fallout`
- `hp.y4.window.first_task_preparation`
- `hp.y4.window.yule_ball`
- `hp.y4.window.second_task_preparation`
- `hp.y4.window.crouch_mystery`
- `hp.y4.window.third_task_and_graveyard`
- `hp.y4.window.voldemort_return_aftermath`

## Year 5: Order of the Phoenix

Goal: support Ministry denial, Order headquarters, Umbridge oppression, DA formation, Occlumency, St Mungo's, Dumbledore's Army exposure, exam pressure, Department of Mysteries, and public return.

Primary anchors:

- `hp.y5.privet_drive_isolation`
- `hp.y5.dementor_attack_little_whinging`
- `hp.y5.patronus_underage_magic_charge`
- `hp.y5.order_rescue`
- `hp.y5.grimmauld_arrival`
- `hp.y5.sirius_trapped_at_grimmauld`
- `hp.y5.order_headquarters_context`
- `hp.y5.housecleaning_phase`
- `hp.y5.ministry_hearing`
- `hp.y5.hearing_acquittal`
- `hp.y5.prefect_badges`
- `hp.y5.decree_22_umbridge_defense`
- `hp.y5.term_arrival_ministry_denial`
- `hp.y5.thestrals_visible_to_harry`
- `hp.y5.umbridge_first_class`
- `hp.y5.blood_quill_detention_begins`
- `hp.y5.harry_hides_detention_scars`
- `hp.y5.high_inquisitor_decree_23`
- `hp.y5.teacher_inspections_begin`
- `hp.y5.da_need_crystallizes`
- `hp.y5.hogs_head_da_recruitment`
- `hp.y5.room_of_requirement_training_begins`
- `hp.y5.da_progress_patronus_training`
- `hp.y5.hagrid_returns`
- `hp.y5.quidditch_match_and_bans`
- `hp.y5.arthur_attack_vision`
- `hp.y5.st_mungos_visit`
- `hp.y5.neville_parents_revealed`
- `hp.y5.occlumency_lessons_begin`
- `hp.y5.snape_memory_exposure`
- `hp.y5.azkaban_escape_public`
- `hp.y5.quibbler_interview`
- `hp.y5.decree_27_quibbler_ban`
- `hp.y5.trelawney_sacked`
- `hp.y5.firenze_hired`
- `hp.y5.da_caught`
- `hp.y5.marietta_betrayal`
- `hp.y5.dumbledore_takes_blame`
- `hp.y5.dumbledore_flees`
- `hp.y5.umbridge_headmistress`
- `hp.y5.twins_fireworks_phase`
- `hp.y5.twins_leave_hogwarts`
- `hp.y5.owls_begin`
- `hp.y5.hagrid_removal_attempt`
- `hp.y5.mcgonagall_stunned`
- `hp.y5.sirius_torture_vision`
- `hp.y5.umbridge_forest`
- `hp.y5.thestral_flight_to_ministry`
- `hp.y5.department_mysteries_battle`
- `hp.y5.sirius_dies`
- `hp.y5.harry_bellatrix_chase`
- `hp.y5.dumbledore_voldemort_duel`
- `hp.y5.voldemort_publicly_seen`
- `hp.y5.prophecy_explained`
- `hp.y5.grief_and_train_home`

Curated windows:

- `hp.y5.window.privet_and_order_rescue`
- `hp.y5.window.grimmauld_before_school`
- `hp.y5.window.umbridge_early_control`
- `hp.y5.window.da_secret_training`
- `hp.y5.window.st_mungos_and_occlumency`
- `hp.y5.window.ministry_crackdown`
- `hp.y5.window.dumbledore_absent_umbridge_headmistress`
- `hp.y5.window.owls_and_removal_attempt`
- `hp.y5.window.department_mysteries`
- `hp.y5.window.public_return_aftermath`

## Year 6: Half-Blood Prince

Goal: support precise starts such as "January of sixth year, after Christmas, before Apparition lessons", "before Ron dates Lavender", "after Katie Bell", "after Ron is poisoned", or "before Sectumsempra".

Primary anchors:

- `hp.y6.privet_summer_after_sirius`
- `hp.y6.dumbledore_collects_harry`
- `hp.y6.slughorn_recruited`
- `hp.y6.burrow_summer`
- `hp.y6.owl_results_arrive`
- `hp.y6.sixth_year_course_access_set`
- `hp.y6.diagon_alley_visit`
- `hp.y6.draco_borgin_burkes_suspicion`
- `hp.y6.hogwarts_express_slug_club`
- `hp.y6.draco_stomps_harry`
- `hp.y6.tonks_rescues_harry`
- `hp.y6.term_arrival_security_context`
- `hp.y6.snape_dada_first_class`
- `hp.y6.slughorn_potions_first_class`
- `hp.y6.half_blood_prince_book`
- `hp.y6.felix_felicis_won`
- `hp.y6.nonverbal_magic_pressure`
- `hp.y6.first_memory_lesson_gaunts`
- `hp.y6.quidditch_tryouts`
- `hp.y6.keeper_selection`
- `hp.y6.first_slug_club_dinner`
- `hp.y6.katie_bell_necklace_attack`
- `hp.y6.hogsmeade_security_tightens`
- `hp.y6.draco_suspicion_after_katie`
- `hp.y6.ron_quidditch_win`
- `hp.y6.ron_lavender_start`
- `hp.y6.hermione_jealousy_spike`
- `hp.y6.slughorn_christmas_party`
- `hp.y6.snape_draco_overheard`
- `hp.y6.christmas_break_burrow`
- `hp.y6.post_christmas_return`
- `hp.y6.horcrux_memory_task_assigned`
- `hp.y6.apparition_lessons_announced`
- `hp.y6.apparition_lessons_begin`
- `hp.y6.susan_bones_splinched`
- `hp.y6.ron_love_potion`
- `hp.y6.ron_poisoned`
- `hp.y6.harry_bezoar_save`
- `hp.y6.ron_hospital_phase`
- `hp.y6.draco_myrtle_clue`
- `hp.y6.felix_felicis_used`
- `hp.y6.aragog_burial`
- `hp.y6.true_slughorn_memory_obtained`
- `hp.y6.horcrux_truth_revealed`
- `hp.y6.sectumsempra_attack`
- `hp.y6.snape_heals_draco`
- `hp.y6.detention_and_prince_book_hidden`
- `hp.y6.harry_ginny_start`
- `hp.y6.dumbledore_cave_mission`
- `hp.y6.locket_fake_revealed`
- `hp.y6.astronomy_tower_crisis`
- `hp.y6.dumbledore_killed`
- `hp.y6.snape_half_blood_prince_reveal`
- `hp.y6.fight_and_flight_aftermath`
- `hp.y6.funeral`
- `hp.y6.harry_ginny_breakup`
- `hp.y6.horcrux_hunt_decision`

Curated windows:

- `hp.y6.window.summer_slughorn_recruitment`
- `hp.y6.window.course_access_and_diagon`
- `hp.y6.window.arrival_to_prince_book`
- `hp.y6.window.dumbledore_lessons_early`
- `hp.y6.window.katie_attack_to_christmas`
- `hp.y6.window.ron_lavender_active`
- `hp.y6.window.christmas_party_and_break`
- `hp.y6.window.post_christmas_before_apparition`
- `hp.y6.window.apparition_lessons`
- `hp.y6.window.ron_poisoning_aftermath`
- `hp.y6.window.slughorn_memory_hunt`
- `hp.y6.window.sectumsempra_aftermath`
- `hp.y6.window.harry_ginny_relationship`
- `hp.y6.window.cave_and_tower`
- `hp.y6.window.funeral_and_horcrux_decision`

Example Context Browser result:

```text
User phrase: "January of their sixth year, after Christmas and before Apparition lessons where Susan Bones loses a leg."
Deck: hp-year-6-half-blood-prince
after: hp.y6.post_christmas_return
before: hp.y6.apparition_lessons_begin
nearby later anchor: hp.y6.susan_bones_splinched
```

## Year 7: Deathly Hallows

Goal: keep one deck, but make its internal phases dense enough to support starts at any Horcrux-hunt, Hallows, capture, Shell Cottage, Gringotts, or Battle point.

Primary anchors:

- `hp.y7.malfoy_manor_burbage_meeting`
- `hp.y7.snape_voldemort_strategy_context`
- `hp.y7.privet_departure_preparation`
- `hp.y7.seven_potters_operation`
- `hp.y7.moody_killed`
- `hp.y7.george_loses_ear`
- `hp.y7.burrow_after_seven_potters`
- `hp.y7.dumbledore_will_bequests`
- `hp.y7.harry_birthday`
- `hp.y7.wedding_preparations`
- `hp.y7.bill_fleur_wedding`
- `hp.y7.ministry_falls`
- `hp.y7.wedding_ambush`
- `hp.y7.grimmauld_place_hideout`
- `hp.y7.rab_discovered`
- `hp.y7.kreacher_locket_story`
- `hp.y7.kreacher_alliance_shift`
- `hp.y7.ministry_infiltration_planned`
- `hp.y7.ministry_infiltration`
- `hp.y7.umbridge_locket_taken`
- `hp.y7.yaxley_grimmauld_compromised`
- `hp.y7.camping_phase_begins`
- `hp.y7.locket_wearing_strain`
- `hp.y7.phineas_portrait_information`
- `hp.y7.ron_leaves`
- `hp.y7.harry_hermione_alone`
- `hp.y7.godrics_hollow_visit`
- `hp.y7.bathilda_nagini_trap`
- `hp.y7.harry_wand_broken`
- `hp.y7.silver_doe_appears`
- `hp.y7.ron_returns`
- `hp.y7.locket_destroyed`
- `hp.y7.lovegood_visit`
- `hp.y7.deathly_hallows_explained`
- `hp.y7.lovegood_betrayal_escape`
- `hp.y7.taboo_snatchers_capture`
- `hp.y7.malfoy_manor_capture`
- `hp.y7.hermione_tortured`
- `hp.y7.dobby_rescue`
- `hp.y7.dobby_dies`
- `hp.y7.shell_cottage_refuge`
- `hp.y7.ollivander_wandlore`
- `hp.y7.griphook_negotiation`
- `hp.y7.teddy_birth`
- `hp.y7.gringotts_breakin`
- `hp.y7.cup_horcrux_taken`
- `hp.y7.dragon_escape`
- `hp.y7.hogwarts_return_plan`
- `hp.y7.aberforth_contact`
- `hp.y7.room_of_requirement_reunion`
- `hp.y7.ravenclaw_diadem_search`
- `hp.y7.carrows_and_hogwarts_resistance`
- `hp.y7.battle_hogwarts_begins`
- `hp.y7.chamber_basilisk_fangs`
- `hp.y7.cup_destroyed`
- `hp.y7.diadem_found`
- `hp.y7.fiendfyre_diadem_destroyed`
- `hp.y7.fred_killed`
- `hp.y7.snape_killed`
- `hp.y7.snape_memories`
- `hp.y7.harry_horcrux_truth`
- `hp.y7.forest_walk`
- `hp.y7.harry_surrenders`
- `hp.y7.kings_cross_vision`
- `hp.y7.narcissa_lies`
- `hp.y7.final_battle_resumes`
- `hp.y7.neville_kills_nagini`
- `hp.y7.voldemort_defeated`
- `hp.y7.elder_wand_resolution`
- `hp.y7.battle_aftermath`

Curated windows:

- `hp.y7.window.malfoy_manor_opening`
- `hp.y7.window.seven_potters_and_burrow`
- `hp.y7.window.wedding_to_ministry_fall`
- `hp.y7.window.grimmauld_and_kreacher`
- `hp.y7.window.ministry_infiltration`
- `hp.y7.window.camping_with_ron`
- `hp.y7.window.ron_absent`
- `hp.y7.window.godrics_hollow`
- `hp.y7.window.ron_return_to_hallows`
- `hp.y7.window.lovegood_to_snatchers`
- `hp.y7.window.malfoy_manor`
- `hp.y7.window.shell_cottage`
- `hp.y7.window.gringotts`
- `hp.y7.window.hogwarts_return`
- `hp.y7.window.battle_first_phase`
- `hp.y7.window.snape_memories_to_forest`
- `hp.y7.window.final_duel`
- `hp.y7.window.battle_aftermath`

## Migration Steps

1. Create new Loredeck folders and manifests for Core plus Years 1-7.
2. Add `deckFamilyId: hp-golden-trio` and `recommendedStack` metadata.
3. Promote existing `lexicon_calendars/year_*` event Lorecards into first-class `timeline.json` anchors for each year deck.
4. Add missing high-value anchors from this plan, especially Year 6 post-Christmas/Apparition and Year 7 phase boundaries.
5. Split entries by primary Context year.
6. Move cross-year global rules into `hp-core`.
7. Convert broad year gates into year-local windows.
8. Add Deck Health checks for anchor density per deck scope.
9. Update the Library to present the family as a collection, while still loading individual decks.
10. Remove the old monolithic `hp-golden-trio` deck once the split passes conformance and retrieval tests.

## Success Criteria

- A user can load `hp-core` plus one year deck and browse the year without seeing seven years of unrelated anchors.
- A user can select Context by exact anchor, broad window, or ad hoc after/before pair.
- Year 6 supports "after Christmas, before Apparition lessons" without a model call.
- The Reasoner Provider can map casual phrases to bounded candidates, not invent timeline structure.
- Entries in a year deck do not inject outside their year-local Context gates.
- Loading all seven year decks still works as a full-series stack, but the user chooses that complexity intentionally.
