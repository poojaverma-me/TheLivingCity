// Dialogue lines + voice casting for The Living City.
// Format (keep exactly):
//   LINES:  [{ id, speaker, text, style? }]   style = optional short per-line delivery note
//   VOICES: { [speaker]: { voice, style } }    voice = Gemini TTS prebuilt voice name, style = short delivery direction
// Gemini TTS tips: keep `style` short (long "director's notes" cause voice drift).
// Inline tags like <short pause>, <laugh>, <sigh> and CAPITALISED emphasis work inside `text`.
// (Not used here so subtitles stay clean; numbers and symbols are spelled out for speech.)
//
// Id scheme:
//   intro_01..04, tut_<move|rotate|zoom|interact|guide|notebook>
//   <organelleId>_<arrive|more|try|done>        organelleId = keys of ORGANELLES in src/data/content.js
//   cur_<curiosityId>                           = CURIOSITIES[].celiaLineId
//   suggest_<organelleId>, idle_01..06, bark_<organelleId>_NN, end_01..02

export const VOICES = {
  // Dr. Celia Mendel: warm, articulate, lightly enthusiastic scientist guide
  celia: { voice: 'Sulafat', style: 'warm, articulate and lightly enthusiastic, like a friendly scientist giving a tour' },
  // Cheerful dock worker (Golgi / vesicle docks)
  worker1: { voice: 'Puck', style: 'cheerful, upbeat and a little cheeky, calling out across a busy dock' },
  // Gruff but friendly engineer (mitochondria power plant, membrane pumps)
  worker2: { voice: 'Algenib', style: 'gruff but friendly, a busy engineer who secretly loves his job' },
  // Quick, precise lab technician (nucleus, nucleolus, rough ER)
  worker3: { voice: 'Achird', style: 'friendly, quick and precise, a lab technician in the middle of a task' },
  // Calm plant operator (smooth ER, lysosomes, vacuoles)
  worker4: { voice: 'Despina', style: 'calm, smooth and dryly humorous, an operator who has seen it all' },
};

const C = 'celia';

export const LINES = [
  // ---------------------------------------------------------------- intro
  { id: 'intro_01', speaker: C, text: "Hello, and welcome to the Living City. I'm Dr. Celia Mendel, and everything around you is happening inside a single animal cell." },
  { id: 'intro_02', speaker: C, text: "A small confession: we've slowed everything down and shown only part of it. Real cells are far faster, and far more crowded.", style: 'confiding, gently amused' },
  { id: 'intro_03', speaker: C, text: "There's no right order here. Wander, poke at things, and follow whatever catches your eye." },
  { id: 'intro_04', speaker: C, text: "And whenever you want me, just press G. I'm always happy to talk shop." },

  // ---------------------------------------------------------------- tutorial hints
  { id: 'tut_move', speaker: C, text: "To walk, use W, A, S and D, or simply click the ground. Hold Shift if you're in a hurry." },
  { id: 'tut_rotate', speaker: C, text: "Press Q or E, or drag with the right mouse button, to turn the view." },
  { id: 'tut_zoom', speaker: C, text: "Scroll to zoom. Scroll all the way out and you'll see the whole city at once." },
  { id: 'tut_interact', speaker: C, text: "See something glowing? Press E, or click it, for a closer look." },
  { id: 'tut_guide', speaker: C, text: "Press G whenever you'd like to know what a place is, or where to go next." },
  { id: 'tut_notebook', speaker: C, text: "Your field notebook keeps track of everything you find. Press N to open it, and H for the controls." },

  // ---------------------------------------------------------------- nucleus
  { id: 'nucleus_arrive', speaker: C, text: "This is the nucleus, the control centre. The DNA lives here, and its instructions go out as RNA copies of genes." },
  { id: 'nucleus_more', speaker: C, text: "See the pores in that double envelope? There are a few thousand of them. Small molecules slip through; big ones need the right molecular passport." },
  { id: 'nucleus_try', speaker: C, text: "Would you like to try transcribing a gene? Pick one at the console, and we'll walk the messenger RNA out together." },
  { id: 'nucleus_done', speaker: C, text: "Beautifully done. The DNA never leaves; only its RNA copy goes out through the pores to the ribosomes." },

  // ---------------------------------------------------------------- nucleolus
  { id: 'nucleolus_arrive', speaker: C, text: "That glowing orb is the nucleolus. Ribosomal RNA is made here, and the pieces of new ribosomes are put together." },
  { id: 'nucleolus_more', speaker: C, text: "Funny thing: it has no membrane at all. It's more like a droplet that condenses around the ribosomal RNA genes." },
  { id: 'nucleolus_try', speaker: C, text: "Would you like to try building a ribosome? We'll assemble a small and a large subunit and send them on their way." },
  { id: 'nucleolus_done', speaker: C, text: "Lovely. The two subunits leave separately, and only clasp together on a messenger RNA out in the cytoplasm." },

  // ---------------------------------------------------------------- ribosomes
  { id: 'ribosomes_arrive', speaker: C, text: "These little red studs are ribosomes, the protein factories. Each one reads messenger RNA and strings amino acids together." },
  { id: 'ribosomes_more', speaker: C, text: "My favourite part: the actual bond-making is done by RNA, not protein. At heart, the ribosome is an ancient ribozyme." },
  { id: 'ribosomes_try', speaker: C, text: "Would you like to try translating? Match each codon to its amino acid and watch your protein grow." },
  { id: 'ribosomes_done', speaker: C, text: "Perfect. Three letters per codon, one amino acid each, until a stop codon says the protein is finished." },

  // ---------------------------------------------------------------- rough ER
  { id: 'rer_arrive', speaker: C, text: "These blue corridors are the rough ER. The studs are ribosomes, feeding new proteins straight into the space inside." },
  { id: 'rer_more', speaker: C, text: "A short signal at the start of a protein works like a ticket. It brings the ribosome here and threads the chain through a channel called Sec sixty-one." },
  { id: 'rer_try', speaker: C, text: "Would you like to try running the production line? Start translation and follow your protein inside." },
  { id: 'rer_done', speaker: C, text: "Nicely done. Signal, docking, threading, folding: that's how secreted and membrane proteins begin their lives." },

  // ---------------------------------------------------------------- smooth ER
  { id: 'ser_arrive', speaker: C, text: "Welcome to the smooth ER. No ribosomes here; these tubules make lipids, help detoxify drugs, and store calcium." },
  { id: 'ser_more', speaker: C, text: "In liver cells, enzymes called P four-fifties add oxygen to fat-soluble toxins, making them easier for the body to flush away." },
  { id: 'ser_try', speaker: C, text: "Would you like to try a detox shift? Catch the drifting toxins and let the enzymes do their work." },
  { id: 'ser_done', speaker: C, text: "Excellent shift. Smooth ER builds lipids and makes toxins easier to excrete. Your liver is doing exactly this right now." },

  // ---------------------------------------------------------------- transport vesicles
  { id: 'vesicles_arrive', speaker: C, text: "These purple bubbles are transport vesicles: little membrane parcels carrying cargo between compartments and out to the surface." },
  { id: 'vesicles_more', speaker: C, text: "They don't really roll on roads. Motor proteins carry them along microtubules: kinesin heads outward, dynein heads back toward the centre." },
  { id: 'vesicles_try', speaker: C, text: "Would you like to launch one? Bud a vesicle from the Golgi and follow it all the way to the membrane." },
  { id: 'vesicles_done', speaker: C, text: "And there's the release. That's exocytosis: the vesicle merges with the cell membrane and its cargo spills outside." },

  // ---------------------------------------------------------------- Golgi
  { id: 'golgi_arrive', speaker: C, text: "This pink stack is the Golgi apparatus, the shipping centre. Proteins from the ER are finished, sorted and addressed here." },
  { id: 'golgi_more', speaker: C, text: "Cargo enters at the cis face, nearest the ER, and leaves from the trans face, collecting sugar modifications along the way." },
  { id: 'golgi_try', speaker: C, text: "Would you like to try sorting cargo? Tag each parcel with its destination, and the conveyors will do the rest." },
  { id: 'golgi_done', speaker: C, text: "Well sorted. Molecular tags, like mannose six-phosphate on lysosomal enzymes, decide where each parcel goes." },

  // ---------------------------------------------------------------- mitochondria
  { id: 'mitochondria_arrive', speaker: C, text: "These orange plants are mitochondria, where most of the cell's ATP is made. Listen to those turbines." },
  { id: 'mitochondria_more', speaker: C, text: "The folds inside are cristae, lined with proton pumps. Mitochondria even keep their own little ring of DNA, a souvenir of their bacterial ancestors." },
  { id: 'mitochondria_try', speaker: C, text: "Would you like to try making some power? Pump protons uphill, then let them spin the turbine." },
  { id: 'mitochondria_done', speaker: C, text: "Look at it go! Protons flowing back turn ATP synthase, and every full turn makes three ATP." },

  // ---------------------------------------------------------------- lysosomes
  { id: 'lysosomes_arrive', speaker: C, text: "These green tanks are lysosomes, the recycling plants. Inside, acid-loving enzymes break worn-out parts back into building blocks." },
  { id: 'lysosomes_more', speaker: C, text: "They hold their insides at about pH four and a half to five. The enzymes barely work at neutral pH, which makes a rather clever safety catch." },
  { id: 'lysosomes_try', speaker: C, text: "Would you like to try some recycling? Feed in a few worn-out parts and watch what happens." },
  { id: 'lysosomes_done', speaker: C, text: "All digested. Proteins become amino acids, and the cell happily puts every one of them back to work." },

  // ---------------------------------------------------------------- vacuoles
  { id: 'vacuoles_arrive', speaker: C, text: "These are the storage tanks: vacuoles, holding water, nutrients and a bit of waste." },
  { id: 'vacuoles_more', speaker: C, text: "I'll be honest, the poster flatters them. Animal cell vacuoles are small and varied; it's plant cells that have one enormous central vacuole." },
  { id: 'vacuoles_try', speaker: C, text: "Would you like to try balancing the tanks? Fill and drain them, and keep the city comfortable." },
  { id: 'vacuoles_done', speaker: C, text: "Nicely balanced. Animal cells manage water mostly with ion pumps; plants lean on that great central vacuole to stay firm." },

  // ---------------------------------------------------------------- cell membrane
  { id: 'membrane_arrive', speaker: C, text: "This is the cell membrane, the city boundary. It's a lipid bilayer that decides what comes in and what goes out." },
  { id: 'membrane_more', speaker: C, text: "In reality it's only about five nanometres thick: a fluid film with proteins drifting through it, not a stone wall." },
  { id: 'membrane_try', speaker: C, text: "Would you like to try being the gatekeeper? Decide how each molecule should get across." },
  { id: 'membrane_done', speaker: C, text: "Spot on. Oxygen just diffuses, glucose needs a carrier, and the sodium-potassium pump pays for every crossing in ATP." },

  // ---------------------------------------------------------------- curiosities (24)
  { id: 'cur_nuclear_pore', speaker: C, text: "A nuclear pore, up close! Each one handles around a thousand crossings a second, and it's remarkably picky about who gets through." },
  { id: 'cur_chromatin_archive', speaker: C, text: "The chromatin archive. Two metres of DNA wound onto histone spools. The real trick is knowing which shelves to open." },
  { id: 'cur_centrosome', speaker: C, text: "Oh, you found the centrosome! It organises the cell's microtubules, and before division it copies itself to form the two spindle poles." },
  { id: 'cur_rrna_genes', speaker: C, text: "Hundreds of copies of the same gene! Ribosomal RNA is never translated, so the only way to make loads of it is lots of genes." },
  { id: 'cur_food_truck', speaker: C, text: "A free ribosome! Same machine as the ones on the ER, just making proteins for the cytosol, the nucleus or the mitochondria." },
  { id: 'cur_signal_ticket', speaker: C, text: "There's the ticket: a signal peptide. A short run of water-shy amino acids, and the protein is on its way into the ER." },
  { id: 'cur_bip_crew', speaker: C, text: "Meet BiP, the folding crew. It holds on to sticky, unfolded stretches until the protein gets its shape right." },
  { id: 'cur_calcium_reservoir', speaker: C, text: "The calcium reservoir. Open that valve and calcium floods out: muscles contract, hormones are released. Small ion, big consequences." },
  { id: 'cur_grapefruit', speaker: C, text: "A grapefruit warning! Grapefruit compounds jam one of the P four-fifty enzymes, so some medicines build up in the blood. Breakfast, it turns out, is pharmacology.", style: 'amused' },
  { id: 'cur_kinesin_walker', speaker: C, text: "Look, a kinesin, walking hand over hand. Eight nanometres a step, one ATP each time." },
  { id: 'cur_endocytosis_gate', speaker: C, text: "Endocytosis in action! A clathrin cage pulls in a patch of membrane, and the cell swallows whatever was waiting outside." },
  { id: 'cur_cytoskeleton_cables', speaker: C, text: "The cytoskeleton. Those cables are scaffolding, tension wires and railway, all at once." },
  { id: 'cur_m6p_tag', speaker: C, text: "That's the mannose six-phosphate tag, the lysosome's postcode. Without it, digestive enzymes get shipped out of the cell by mistake." },
  { id: 'cur_cis_trans_signs', speaker: C, text: "Cis and trans signs! Cis faces the ER, trans faces the cell surface. Even the Golgi needs to know which way is up." },
  { id: 'cur_mtdna_ring', speaker: C, text: "The mitochondrial DNA ring: thirty-seven genes, inherited almost entirely from your mother. Perhaps thank her next time you call.", style: 'warm, gently amused' },
  { id: 'cur_krebs_roundabout', speaker: C, text: "The Krebs roundabout. Carbon comes in, carbon dioxide goes out, and the electrons are handed on to the power plant." },
  { id: 'cur_atp_counter', speaker: C, text: "Check that counter. You recycle roughly your own body weight in ATP every single day." },
  { id: 'cur_autophagy', speaker: C, text: "Autophagy, literally self-eating. Less grim than it sounds: it's how cells clean house and get through lean times." },
  { id: 'cur_ph_gauge', speaker: C, text: "pH four and a half. Acidic enough to digest almost anything, and kept that way by proton pumps working nonstop." },
  { id: 'cur_rubber_duck', speaker: C, text: "Is that a rubber duck? That is not an organelle. I'll be having a word with the vacuole crew.", style: 'amused, mock-stern' },
  { id: 'cur_aquaporin', speaker: C, text: "An aquaporin! Water marches through in single file, billions of molecules a second, while protons are kept firmly out." },
  { id: 'cur_receptor_antenna', speaker: C, text: "A receptor antenna. Its family picks up hormones, scents and even light, and about a third of all medicines target it." },
  { id: 'cur_peroxisome', speaker: C, text: "A peroxisome, our little guest! It breaks down very long fatty acids, and its catalase makes short work of hydrogen peroxide." },
  { id: 'cur_apoptosis_switch', speaker: C, text: "Please don't press that! It's apoptosis, a tidy, programmed self-destruct. Your body uses it billions of times a day, just not here, please.", style: 'quick, slightly alarmed, then amused' },

  // ---------------------------------------------------------------- suggestions (by district; landmarks, not directions)
  { id: 'suggest_nucleus', speaker: C, text: "If you haven't been yet, the violet dome is worth a visit. That's the nucleus, and the screens inside are rather mesmerising." },
  { id: 'suggest_rer', speaker: C, text: "Those blue terraced rings around the dome are the rough ER. Walk along them and you'll catch proteins being made." },
  { id: 'suggest_ser', speaker: C, text: "Have you found the green ribbon folds yet? That's the smooth ER, quietly making lipids and cleaning up toxins." },
  { id: 'suggest_golgi', speaker: C, text: "The pink stacked building near the front gate is the Golgi. It's the busiest shipping hall in town." },
  { id: 'suggest_mitochondria', speaker: C, text: "Hear that humming? Follow it to the big orange capsules. Those are the mitochondria, our power plants." },
  { id: 'suggest_lysosomes', speaker: C, text: "Look for the green tanks with the recycling symbol. That's where the lysosomes take old parts apart." },
  { id: 'suggest_vacuoles', speaker: C, text: "The round tanks of turquoise water are the vacuoles. Go and have a look, and keep an eye on the water." },
  { id: 'suggest_membrane', speaker: C, text: "Try walking out to the edge of the city. The membrane gates have far more going on than you'd think." },

  // ---------------------------------------------------------------- idle / ambient
  { id: 'idle_01', speaker: C, text: "Somewhere in your body, all of this is happening right now, in trillions of cells at once. Rather humbling, isn't it?" },
  { id: 'idle_02', speaker: C, text: "I never tire of this place. Every corner is quietly doing something useful." },
  { id: 'idle_03', speaker: C, text: "You have roughly thirty trillion cells. Most of them are red blood cells, which have thrown out their nucleus entirely." },
  { id: 'idle_04', speaker: C, text: "Take your time. Science is mostly patient looking, with the occasional gasp." },
  { id: 'idle_05', speaker: C, text: "If you're wondering where to go next, press G and I'll point you somewhere interesting." },
  { id: 'idle_06', speaker: C, text: "Listen for a moment. That hum is thousands of machines, each doing one small job very well.", style: 'softly' },

  // ---------------------------------------------------------------- worker barks (14)
  { id: 'bark_nucleolus_01', speaker: 'worker3', text: "Ribosome subunits, fresh from the nucleolus! Small ones this way, large ones that way!" },
  { id: 'bark_nucleus_01', speaker: 'worker3', text: "Messenger RNA coming through! Capped, spliced and tailed. Mind the pore!" },
  { id: 'bark_rer_01', speaker: 'worker3', text: "No ticket, no entry! Signal sequence first, then into the translocon." },
  { id: 'bark_rer_02', speaker: 'worker3', text: "Folding crew, we've got a stubborn one here. Send BiP over!" },
  { id: 'bark_ser_01', speaker: 'worker4', text: "Another batch of toxins for the P four-fifties. The liver shift never ends." },
  { id: 'bark_golgi_01', speaker: 'worker1', text: "Parcel coming through! Glycosylated, labelled and ready to ship!" },
  { id: 'bark_golgi_02', speaker: 'worker1', text: "Mannose six-phosphate on this one. Lysosome delivery, express!" },
  { id: 'bark_vesicles_01', speaker: 'worker1', text: "Vesicle departing for the membrane! Kinesin's driving, so hold on tight!" },
  { id: 'bark_mitochondria_01', speaker: 'worker2', text: "Mind the turbines. This plant makes the ATP that keeps the whole city running.", style: 'raising his voice slightly over machinery' },
  { id: 'bark_mitochondria_02', speaker: 'worker2', text: "Keep the oxygen coming! No oxygen at the end of the line, no power for anyone." },
  { id: 'bark_membrane_01', speaker: 'worker2', text: "Three sodium out, two potassium in. One ATP. Next!" },
  { id: 'bark_lysosomes_01', speaker: 'worker4', text: "Old parts in, building blocks out. Nothing goes to waste around here." },
  { id: 'bark_lysosomes_02', speaker: 'worker4', text: "Keep it acidic, team. pH four and a half to five, and not a drop higher." },
  { id: 'bark_vacuoles_01', speaker: 'worker4', text: "Tanks are topped up. Has anyone seen my duck?" },

  // ---------------------------------------------------------------- ending / afterglow
  { id: 'end_01', speaker: C, text: "That's everything: every district, every experiment, every hidden corner. You've seen a whole cell at work. Bravo!", style: 'delighted, warm' },
  { id: 'end_02', speaker: C, text: "The city never stops, of course. Do keep wandering; there's always something new to notice." },
];
