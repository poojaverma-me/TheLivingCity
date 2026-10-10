// Science content for The Living City.
//   ORGANELLES  — the 11 poster districts (cards, analogy notes, deeper science, "Would you like to try?")
//   CURIOSITIES — 24 hidden discoveries (celiaLineId points at a line id in src/data/dialogue.js)
//   HELP        — controls + the "slowed and simplified" note
// Colours follow the poster label colours, darkened where needed so text reads on white (WCAG >= 4.5:1).

export const ORGANELLES = {
  nucleus: {
    num: 1,
    title: 'Nucleus',
    cityRole: 'Control Center',
    color: '#6B3FA0',
    cardText: 'Stores the cell’s DNA and decides which genes are copied into RNA, and when.',
    analogyNote: 'City hall is a fair picture of the information flow, but the nucleus issues no direct orders: it sends out RNA copies of genes, and proteins do the work.',
    deep: [
      'The nucleus is wrapped in the nuclear envelope: two lipid bilayers separated by a perinuclear space that is continuous with the lumen of the endoplasmic reticulum. A meshwork of lamin filaments lines the inner membrane, giving the nucleus its shape and anchoring chromatin. In a typical mammalian cell the nucleus is about 5–10 µm across.',
      'Traffic crosses the envelope through nuclear pore complexes (NPCs): huge assemblies built from about 30 different nucleoporins, roughly 110–120 MDa each in vertebrates, with a few thousand pores per nucleus. Small molecules diffuse through freely; larger cargo needs a nuclear localisation or export signal recognised by importins and exportins. A gradient of the small GTPase Ran (Ran-GTP high inside, Ran-GDP outside) sets the direction of transport.',
      'Inside, about 2 metres of DNA (the diploid human genome, roughly 6.4 billion base pairs) is packaged as chromatin. About 147 base pairs at a time wrap around an octamer of histone proteins to form a nucleosome, and nucleosomes fold further. Loosely packed euchromatin is generally active; dense heterochromatin is mostly silent.',
      'Gene expression starts here. RNA polymerase II transcribes protein-coding genes into pre-mRNA, which receives a 5′ cap, is spliced to remove introns and gains a poly(A) tail. Quality-control checks help ensure that mainly mature, correctly processed mRNAs are exported through the pores to the cytoplasm.',
    ],
    funFact: 'Stretched end to end, the DNA in one human nucleus would reach about 2 metres, yet it fits in a space roughly a hundredth of a millimetre wide.',
    tryIt: {
      title: 'Transcribe a Gene',
      prompt: 'Would you like to try? Pick a gene at the console, follow RNA polymerase along the DNA, then guide your new mRNA out through a nuclear pore.',
      takeaway: 'DNA stays in the nucleus; RNA polymerase copies a gene into mRNA, which is processed and exported through nuclear pores to the ribosomes.',
    },
  },

  nucleolus: {
    num: 2,
    title: 'Nucleolus',
    cityRole: 'Ribosome Workshop',
    color: '#2E6FB7',
    cardText: 'Makes ribosomal RNA and assembles ribosome subunits inside the nucleus.',
    analogyNote: 'Shown as a glowing orb, but the nucleolus has no membrane: it is a dense, self-organising cluster of RNA and protein around the ribosomal RNA genes.',
    deep: [
      'The nucleolus is the largest structure inside the nucleus, and it is not enclosed by a membrane. It forms around clusters of ribosomal DNA (rDNA) repeats, which in humans lie on the short arms of chromosomes 13, 14, 15, 21 and 22, and it behaves like a biomolecular condensate: a liquid-like droplet held together by many weak interactions.',
      'RNA polymerase I transcribes the rDNA repeats into a long precursor, the 47S pre-rRNA. Guided by small nucleolar RNAs (snoRNAs), it is chemically modified and cut into the 18S, 5.8S and 28S rRNAs. The fourth rRNA, 5S, is made by RNA polymerase III elsewhere in the nucleus and brought in.',
      'Ribosomal proteins are made in the cytoplasm, imported through nuclear pores, and assembled with the rRNAs. The small (40S) subunit carries 18S rRNA; the large (60S) subunit carries 28S, 5.8S and 5S rRNA. The two subunits are exported separately and join only on an mRNA in the cytoplasm, forming the 80S ribosome.',
      'Electron micrographs show three layers: fibrillar centres, a dense fibrillar component where rRNA is transcribed and processed, and an outer granular component where subunits are assembled. The nucleolus is large in fast-growing cells, disassembles during mitosis, and re-forms afterwards.',
    ],
    funFact: 'Ribosomal RNA makes up roughly 80% of all the RNA in a typical cell, which makes the nucleolus one of the busiest places in the nucleus.',
    tryIt: {
      title: 'Assemble a Ribosome',
      prompt: 'Would you like to try? Fit fresh rRNA and ribosomal proteins together into a small and a large subunit, then send them off for export.',
      takeaway: 'The nucleolus builds 40S and 60S subunits from rRNA and imported proteins; they leave the nucleus separately and unite only on an mRNA in the cytoplasm.',
    },
  },

  ribosomes: {
    num: 3,
    title: 'Ribosomes',
    cityRole: 'Factories',
    color: '#C2408A',
    cardText: 'Build proteins by reading mRNA copies of the DNA’s instructions.',
    analogyNote: 'Here they are factories bolted to the highways; in reality the same ribosomes work either free in the cytosol or on the ER, depending on the protein they are making.',
    deep: [
      'A ribosome is a molecular machine made of rRNA and about 80 proteins. The eukaryotic 80S ribosome is roughly 25–30 nm across and weighs about 4 MDa, and a single mammalian cell contains millions of them.',
      'Translation reads mRNA three nucleotides (one codon) at a time. Transfer RNAs carry amino acids and pair their anticodons with codons at three sites: A (aminoacyl), P (peptidyl) and E (exit). Of the 64 codons, 61 specify amino acids and 3 are stop signals; AUG encodes methionine and usually marks the start.',
      'Peptide bonds are formed by rRNA in the large subunit’s peptidyl transferase centre, so the ribosome is a ribozyme. The growing chain leaves through an exit tunnel about 10 nm long that shelters the newest 30–40 amino acids.',
      'Eukaryotic ribosomes add roughly 5 amino acids per second, so an average protein takes a minute or two. Several ribosomes usually read the same mRNA at once, forming a polysome. Free ribosomes make proteins for the cytosol, nucleus, mitochondria and peroxisomes; when a chain begins with an ER signal sequence, the ribosome is escorted to the rough ER.',
    ],
    funFact: 'The ribosome’s core chemistry is done by RNA, not protein: a strong clue that early life may once have run on RNA alone.',
    tryIt: {
      title: 'Translate mRNA',
      prompt: 'Would you like to try? Read the mRNA one codon at a time, match each to the right tRNA, and watch the chain grow.',
      takeaway: 'Ribosomes read mRNA in three-letter codons; tRNAs bring the matching amino acids, and the ribosome links them until it reaches a stop codon.',
    },
  },

  rer: {
    num: 4,
    title: 'Rough Endoplasmic Reticulum',
    cityRole: 'Highways (with Ribosomes)',
    color: '#B4561A',
    cardText: 'Ribosome-studded membranes where secreted and membrane proteins are made, folded and checked.',
    analogyNote: 'Drawn as roads, but the ER is one continuous membrane network enclosing a single lumen; proteins are made and folded inside it, then leave in vesicles rather than driving along it.',
    deep: [
      'The endoplasmic reticulum is a single continuous network of membrane sheets and tubules. Its interior, the lumen, is continuous with the space between the two nuclear membranes, and in many animal cells the ER makes up more than half of all membrane. Sheet-like regions studded with ribosomes form the rough ER.',
      'Proteins bound for secretion, the plasma membrane, lysosomes, or the ER and Golgi themselves usually begin with a signal sequence. As it emerges from the ribosome, the signal recognition particle (SRP) binds it, slows translation and delivers the ribosome to the SRP receptor on the ER. The chain is then threaded through the Sec61 translocon as it is made (co-translational translocation).',
      'In the lumen, signal peptidase removes the signal sequence, and oligosaccharyltransferase attaches a preassembled 14-sugar glycan to asparagines in Asn-X-Ser/Thr motifs (N-linked glycosylation). Chaperones such as BiP, calnexin and calreticulin assist folding, and protein disulfide isomerase forms and rearranges disulfide bonds.',
      'Quality control is strict. Misfolded proteins are held back, refolded, or returned to the cytosol for destruction by the proteasome (ER-associated degradation, ERAD). If unfolded proteins pile up, the unfolded protein response expands the ER and slows protein synthesis; if the stress persists, it can trigger cell death.',
    ],
    funFact: 'Cells built for secretion are packed with rough ER: an antibody-producing plasma cell can release around 2,000 antibody molecules every second.',
    tryIt: {
      title: 'Watch Protein Production',
      prompt: 'Would you like to try? Start translation, watch the signal peptide dock at the ER, and follow the new protein as it folds inside the lumen.',
      takeaway: 'A signal sequence brings the ribosome to the ER via SRP; the chain threads through Sec61 into the lumen, where it is trimmed, glycosylated and folded with chaperones.',
    },
  },

  ser: {
    num: 5,
    title: 'Smooth Endoplasmic Reticulum',
    cityRole: 'Highways (No Ribosomes)',
    color: '#4E7A2C',
    cardText: 'Ribosome-free ER tubules that make lipids, help detoxify drugs and store calcium.',
    analogyNote: 'Drawn as a separate green district, but smooth ER is continuous with rough ER: the same membrane network, just tubular and without ribosomes.',
    deep: [
      'Smooth ER is a branching network of tubules without ribosomes, continuous with the rough ER. Its amount varies hugely by cell type: it is abundant in liver cells, in steroid-hormone-producing cells of the adrenal glands and gonads, and in muscle, where it is specialised as the sarcoplasmic reticulum.',
      'The ER membrane is the cell’s main lipid factory. Enzymes on its cytosolic face make most membrane phospholipids and cholesterol, and in specialised cells ER enzymes help convert cholesterol into steroid hormones. Lipid droplets, the cell’s fat stores, also bud from the ER.',
      'In liver cells, cytochrome P450 enzymes in the smooth ER oxidise drugs and other fat-soluble foreign compounds, making them more water-soluble and easier to excrete. Repeated exposure to some drugs, such as phenobarbital, makes liver cells expand their smooth ER. Liver ER also contains glucose-6-phosphatase, which lets the liver release glucose into the blood.',
      'The ER is the main intracellular calcium store. SERCA pumps use ATP to load Ca²⁺ into the lumen, reaching concentrations thousands of times higher than in the resting cytosol (about 100 nM). Opening IP₃ receptors or ryanodine receptors releases a burst of Ca²⁺ that triggers events such as muscle contraction and secretion.',
    ],
    funFact: 'P450s can also turn a harmless compound into a harmful one: an overdose of paracetamol (acetaminophen) injures the liver because a P450 product, NAPQI, builds up once glutathione runs out.',
    tryIt: {
      title: 'Detox Shift',
      prompt: 'Would you like to try? Catch the drifting toxin molecules so the P450 enzymes can process them, then help package fresh lipids into droplets.',
      takeaway: 'Smooth ER makes lipids and, in liver cells, its P450 enzymes chemically modify fat-soluble drugs and toxins so the body can excrete them.',
    },
  },

  vesicles: {
    num: 6,
    title: 'Transport Vesicles',
    cityRole: 'Delivery Vehicles',
    color: '#6B3FA0',
    cardText: 'Small membrane bubbles that carry cargo between compartments and to the cell surface.',
    analogyNote: 'Shown as large purple orbs on roads, but real vesicles are about 50–100 nm wide and are hauled along microtubule tracks by motor proteins.',
    deep: [
      'Transport vesicles are small spheres of lipid bilayer, typically 50–100 nm across, that carry proteins and lipids between membrane compartments. Cargo inside the vesicle, or embedded in its membrane, moves without ever having to cross a membrane.',
      'Vesicles form when coat proteins assemble on a membrane, gather cargo and bend the membrane into a bud. Different coats serve different routes: COPII carries cargo from the ER to the Golgi; COPI returns material from the Golgi to the ER and between Golgi cisternae; clathrin, with adaptor proteins, works at the trans-Golgi network and the plasma membrane, where the GTPase dynamin pinches the vesicle free.',
      'Long-distance travel uses the cytoskeleton. Kinesins generally walk toward microtubule plus ends, out toward the cell periphery, while cytoplasmic dynein walks toward the minus ends near the centrosome. Short final trips often run on actin filaments, driven by myosin motors.',
      'Delivery depends on recognition and fusion. Rab GTPases mark compartment identity and recruit tethering factors, then matching SNARE proteins on the vesicle and the target membrane zip together, pulling the two bilayers into fusion. Fusion with the plasma membrane (exocytosis) releases cargo outside the cell; endocytosis brings material in.',
    ],
    funFact: 'Discovering how vesicles bud, find their target and fuse earned James Rothman, Randy Schekman and Thomas Südhof the 2013 Nobel Prize in Physiology or Medicine.',
    tryIt: {
      title: 'Launch a Vesicle',
      prompt: 'Would you like to try? Bud a vesicle from the Golgi, ride it along a microtubule, and fuse it with the cell membrane to release its cargo.',
      takeaway: 'Vesicles bud from one membrane, are carried by motor proteins along microtubules, and fuse with their target; fusion with the plasma membrane is exocytosis.',
    },
  },

  golgi: {
    num: 7,
    title: 'Golgi Apparatus',
    cityRole: 'Packaging & Shipping Center',
    color: '#B14A12',
    cardText: 'Modifies, sorts and packages proteins and lipids, then ships them to their destinations.',
    analogyNote: 'A shipping centre is apt, but the stack itself is the processing line: cargo is modified as it moves from cis to trans, and its “address labels” are molecular signals, not paper.',
    deep: [
      'The Golgi apparatus is a stack of flattened membrane sacs called cisternae, usually 4–8 in animal cells, sitting near the nucleus and centrosome. It is polarised: the cis face receives material from the ER, cargo passes through the medial cisternae, and the trans face and trans-Golgi network (TGN) send it onward.',
      'As proteins pass through, Golgi enzymes remodel their N-linked sugar chains, trimming mannose and adding sugars such as N-acetylglucosamine, galactose and sialic acid. O-linked glycosylation, proteoglycan assembly and the synthesis of sphingomyelin and glycolipids also happen here.',
      'How cargo moves through the stack is still debated. The leading cisternal maturation model proposes that each cisterna itself matures from cis to trans, while COPI vesicles carry resident enzymes backward. ER-resident proteins that escape carry a KDEL signal and are fetched back by KDEL receptors.',
      'At the TGN, cargo is sorted. Lysosomal enzymes carry a mannose-6-phosphate (M6P) tag, whose addition begins in the cis Golgi; M6P receptors capture them into clathrin-coated vesicles bound for endosomes and lysosomes. Other cargo leaves for constitutive secretion, for the plasma membrane, or in secretory granules that wait for a signal (regulated secretion).',
    ],
    funFact: 'Camillo Golgi described the organelle in 1898 using a silver stain he had invented. Many scientists suspected it was a staining artefact until electron microscopy confirmed it in the 1950s.',
    tryIt: {
      title: 'Sort the Cargo',
      prompt: 'Would you like to try? Tag each parcel for the lysosome, the cell membrane or secretion, and watch the conveyors route it.',
      takeaway: 'The Golgi modifies cargo as it moves from cis to trans, then sorts it by molecular tags, such as mannose-6-phosphate for lysosomal enzymes.',
    },
  },

  mitochondria: {
    num: 8,
    title: 'Mitochondria',
    cityRole: 'Power Plants',
    color: '#5F7A26',
    cardText: 'Convert energy from food molecules into ATP, the cell’s energy currency.',
    analogyNote: '“Power plant” is apt, but mitochondria make no electricity: they turn a proton gradient into ATP, and they also build molecules, buffer calcium and help control cell death.',
    deep: [
      'Mitochondria have two membranes. The porous outer membrane contains porins (VDAC); the inner membrane is folded into cristae, packed with the respiratory chain, and almost impermeable to ions. It encloses the matrix, where the citric acid cycle and fatty-acid β-oxidation take place. In many cells mitochondria form a dynamic network that constantly fuses and divides.',
      'Electrons from NADH and FADH₂ pass along complexes I–IV of the electron transport chain to oxygen, forming water. Complexes I, III and IV use the released energy to pump protons from the matrix into the intermembrane space, building a proton-motive force of roughly 150–200 mV across the inner membrane.',
      'Protons flow back through ATP synthase, a rotary motor. The flow turns a ring of c subunits and a central stalk, which drives shape changes in the F₁ head that make three ATP per full turn, at up to about 100 rotations per second. Complete oxidation of one glucose molecule yields roughly 30–32 ATP.',
      'Mitochondria descend from an alphaproteobacterium taken up by an ancestral cell around 1.5–2 billion years ago. They keep their own small circular genome (in humans about 16.5 kb, with 37 genes) and their own ribosomes, but import over a thousand proteins encoded in the nucleus. They are inherited almost entirely from the mother.',
    ],
    funFact: 'A heart muscle cell holds thousands of mitochondria, filling roughly a third of its volume.',
    tryIt: {
      title: 'Proton Power',
      prompt: 'Would you like to try? Pump protons across the inner membrane, then let them rush back through ATP synthase and watch the rotor spin out ATP.',
      takeaway: 'The electron transport chain pumps protons to build a gradient; their flow back through ATP synthase turns its rotor and produces ATP.',
    },
  },

  lysosomes: {
    num: 9,
    title: 'Lysosomes',
    cityRole: 'Recycling Plants',
    color: '#2E6FB7',
    cardText: 'Acidic compartments that break down worn-out parts, debris and engulfed material.',
    analogyNote: '“Recycling plant” fits well: lysosomes digest large molecules into building blocks that are exported back to the cytosol for reuse.',
    deep: [
      'Lysosomes are membrane-bound compartments, typically 0.1–1 µm across, containing around 60 different acid hydrolases: proteases (cathepsins), nucleases, lipases, glycosidases, phosphatases and sulfatases. Together they can digest every major class of biological macromolecule.',
      'A V-type ATPase in the lysosomal membrane uses ATP to pump protons inward, keeping the lumen at about pH 4.5–5. The hydrolases work best at this acidic pH and are far less active at the cytosol’s pH of about 7.2, a built-in safeguard if a lysosome leaks. Heavily glycosylated membrane proteins such as LAMP1 and LAMP2 shield the membrane from self-digestion.',
      'Material arrives by several routes: endocytosis brings cargo from outside via endosomes, phagocytosis delivers large particles such as bacteria, and autophagy delivers the cell’s own worn-out components. The resulting amino acids, sugars, nucleotides and lipids are transported out for reuse.',
      'Lysosomes are also signalling hubs: the nutrient sensor mTORC1 is activated on their surface, linking nutrient supply to cell growth. Inherited defects in single lysosomal enzymes or transporters cause around 70 lysosomal storage diseases, such as Tay–Sachs and Gaucher disease, in which undigested material accumulates.',
    ],
    funFact: 'Christian de Duve found lysosomes in the 1950s after noticing that an acid phosphatase in his liver extracts became more active after a few days in storage: the enzyme had been sealed inside membrane sacs. He shared the 1974 Nobel Prize.',
    tryIt: {
      title: 'Recycle',
      prompt: 'Would you like to try? Feed worn-out parts, like an old piece of mitochondrion or a damaged protein, into the recycling tank and watch them break down.',
      takeaway: 'Lysosomes use acid hydrolases at pH 4.5–5 to digest worn-out parts and engulfed material into building blocks the cell reuses.',
    },
  },

  vacuoles: {
    num: 10,
    title: 'Vacuoles',
    cityRole: 'Storage Tanks',
    color: '#357D4E',
    cardText: 'Membrane sacs that store water, nutrients and waste. In animal cells they are small and varied.',
    analogyNote: 'The big open water tanks are artistic licence: animal cells have only small, varied vacuoles, and a giant central vacuole is a hallmark of plant cells.',
    deep: [
      'A vacuole is a membrane-bound sac used for storage, transport or digestion. In animal cells vacuoles are small and diverse, and the term overlaps with vesicles, endosomes and lysosome-related compartments.',
      'Plant cells usually have one large central vacuole that can fill up to 80–90% of the cell. Its membrane, the tonoplast, pumps in ions and sugars and water follows by osmosis, creating turgor pressure against the cell wall that keeps leaves and stems firm. It also stores pigments, defence compounds and waste, and contains lysosome-like digestive enzymes.',
      'Many freshwater protists, such as Paramecium, have contractile vacuoles that collect excess water entering by osmosis and expel it, so the cell does not burst. Animal cells have no cell wall and mainly control their volume with ion pumps such as the Na⁺/K⁺-ATPase, with water following through aquaporins.',
      'Animal cells also form temporary vacuoles: phagocytic white blood cells enclose bacteria in phagosomes, and autophagosomes wrap up old components for delivery to lysosomes.',
    ],
    funFact: 'The red of beetroot and the purple of red cabbage are pigments dissolved in the central vacuoles of plant cells.',
    tryIt: {
      title: 'Fill and Drain',
      prompt: 'Would you like to try? Fill and drain the storage tanks to keep the city’s water and nutrients in balance.',
      takeaway: 'Vacuoles store water, nutrients and waste; animal cells keep theirs small and balance water with ion pumps, while plants rely on one large central vacuole for turgor.',
    },
  },

  membrane: {
    num: 11,
    title: 'Cell Membrane',
    cityRole: 'City Boundary',
    color: '#9A6F0C',
    cardText: 'A lipid bilayer that encloses the cell and controls what enters and leaves.',
    analogyNote: 'The city wall looks thick and rigid, but the real plasma membrane is a fluid film only about 5 nm thick, with proteins drifting through it.',
    deep: [
      'The plasma membrane is a phospholipid bilayer about 5 nm thick. Each phospholipid has a hydrophilic head and two hydrophobic tails; the tails face inward, forming a barrier to ions and most polar molecules. Cholesterol, present at up to about one molecule per phospholipid, stiffens the bilayer and reduces its permeability.',
      'Proteins make up about half the membrane’s mass. Transmembrane proteins form channels, carriers and pumps; receptors relay signals; others anchor the cytoskeleton or bind neighbouring cells. In the fluid mosaic model (Singer and Nicolson, 1972), lipids and many proteins diffuse sideways within the membrane, although many are corralled into domains.',
      'Transport follows simple rules. Small nonpolar molecules such as O₂ and CO₂ diffuse straight through. Glucose uses carrier proteins (GLUTs) and moves down its concentration gradient by facilitated diffusion. The Na⁺/K⁺-ATPase spends one ATP to pump 3 Na⁺ out and 2 K⁺ in, maintaining gradients that power other transport and electrical signalling; it can use up to about a third of an animal cell’s energy.',
      'The two leaflets differ. Phosphatidylserine sits mainly in the inner leaflet, and when it appears on the outside it acts as an “eat me” signal to phagocytes. Sugar chains on outer-surface lipids and proteins form the glycocalyx, which helps cells recognise one another.',
    ],
    funFact: 'Scale a 20 µm cell up to the size of a 200-metre stadium and its membrane would be only about 5 cm thick.',
    tryIt: {
      title: 'Gatekeeper',
      prompt: 'Would you like to try? Decide how each molecule crosses: let oxygen diffuse, send glucose through its transporter, and run the sodium–potassium pump.',
      takeaway: 'O₂ diffuses straight through; glucose needs a carrier but still moves down its gradient; the Na⁺/K⁺ pump spends ATP to move ions against theirs.',
    },
  },
};

export const CURIOSITIES = [
  // Nucleus (3)
  {
    id: 'nuclear_pore',
    district: 'nucleus',
    title: 'Nuclear Pore Checkpoint',
    text: 'Each pore is built from about 30 kinds of nucleoporin, its channel filled with a mesh of floppy FG-repeat proteins. Small molecules slip through, while large cargo needs a signal recognised by importin or exportin escorts. A single pore can handle on the order of a thousand crossings per second.',
    celiaLineId: 'cur_nuclear_pore',
  },
  {
    id: 'chromatin_archive',
    district: 'nucleus',
    title: 'Chromatin Archive',
    text: 'DNA is stored on spools: about 147 base pairs wrap around each histone octamer to form a nucleosome, like thread on a bobbin. Chemical marks on histones and DNA help decide which shelves are open for reading and which stay archived. Nearly every cell has the same genome; what differs is which shelves are open.',
    celiaLineId: 'cur_chromatin_archive',
  },
  {
    id: 'centrosome',
    district: 'nucleus',
    title: 'Centrosome Depot',
    text: 'Beside the nucleus sits the centrosome, the main microtubule-organising centre of animal cells. Its two centrioles, each a ring of nine microtubule triplets, lie at right angles inside a cloud of proteins that nucleate new microtubules. It duplicates once per cell cycle, and the two copies become the poles of the mitotic spindle.',
    celiaLineId: 'cur_centrosome',
  },
  // Nucleolus (1)
  {
    id: 'rrna_genes',
    district: 'nucleolus',
    title: 'rRNA Gene Clusters',
    text: 'Humans carry a few hundred copies of the rRNA gene, in tandem arrays on five chromosomes. An mRNA can be translated again and again, but each rRNA molecule is a finished product, so the only way to make millions of ribosomes is many genes transcribed at full speed.',
    celiaLineId: 'cur_rrna_genes',
  },
  // Ribosomes (1)
  {
    id: 'food_truck',
    district: 'ribosomes',
    title: 'Free Ribosome Food Truck',
    text: 'Not every ribosome parks on the ER. Free ribosomes in the cytosol make proteins for the cytosol, the nucleus, mitochondria and peroxisomes. It is the same machine either way: the protein being made decides where the ribosome works.',
    celiaLineId: 'cur_food_truck',
  },
  // Rough ER (2)
  {
    id: 'signal_ticket',
    district: 'rer',
    title: 'Signal Peptide Ticket',
    text: 'A short run of hydrophobic amino acids, usually at the very start of a protein, works as a boarding pass to the ER. The signal recognition particle reads it and docks the ribosome on the ER, and once the chain is inside, signal peptidase usually snips the ticket off. Günter Blobel won the 1999 Nobel Prize for this “signal hypothesis”.',
    celiaLineId: 'cur_signal_ticket',
  },
  {
    id: 'bip_crew',
    district: 'rer',
    title: 'BiP Chaperone Crew',
    text: 'BiP is an Hsp70-family chaperone in the ER lumen. It grips exposed hydrophobic stretches of new proteins, using ATP to bind and release them until they fold properly. When unfolded proteins pile up, BiP lets go of the ER’s stress sensors, switching on the unfolded protein response.',
    celiaLineId: 'cur_bip_crew',
  },
  // Smooth ER (2)
  {
    id: 'calcium_reservoir',
    district: 'ser',
    title: 'Calcium Reservoir',
    text: 'SERCA pumps keep Ca²⁺ in the ER thousands of times more concentrated than in the surrounding cytosol. Open the IP₃ or ryanodine receptor “valves” and a burst of calcium tells the cell to contract, secrete or switch on genes. In muscle this reservoir is called the sarcoplasmic reticulum.',
    celiaLineId: 'cur_calcium_reservoir',
  },
  {
    id: 'grapefruit',
    district: 'ser',
    title: 'Grapefruit Warning',
    text: 'Furanocoumarins in grapefruit block CYP3A4, a P450 enzyme in the ER, mainly in cells of the gut wall. With that enzyme out of action, more of certain drugs, including some statins, reaches the bloodstream. That is why some medicine labels warn against grapefruit juice.',
    celiaLineId: 'cur_grapefruit',
  },
  // Vesicles (3)
  {
    id: 'kinesin_walker',
    district: 'vesicles',
    title: 'Kinesin Walker',
    text: 'Kinesin-1 walks along a microtubule hand over hand, taking 8 nm steps and spending one ATP per step. At up to about 100 steps a second, it hauls a vesicle many times its own size toward the edge of the cell.',
    celiaLineId: 'cur_kinesin_walker',
  },
  {
    id: 'endocytosis_gate',
    district: 'vesicles',
    title: 'Endocytosis Gate',
    text: 'At the side gate, three-legged clathrin units assemble into a basket that pulls a patch of membrane inward. The GTPase dynamin then wraps around the neck and pinches the new vesicle free. This is how cells take up cholesterol-carrying LDL particles from the blood.',
    celiaLineId: 'cur_endocytosis_gate',
  },
  {
    id: 'cytoskeleton_cables',
    district: 'vesicles',
    title: 'Cytoskeleton Cables',
    text: 'The cables overhead stand in for the cytoskeleton: actin filaments (about 7 nm wide), intermediate filaments (about 10 nm) and microtubules (about 25 nm). Together they shape the cell, resist stretching and serve as tracks. Microtubules constantly grow and shrink, a behaviour called dynamic instability.',
    celiaLineId: 'cur_cytoskeleton_cables',
  },
  // Golgi (2)
  {
    id: 'm6p_tag',
    district: 'golgi',
    title: 'Mannose-6-Phosphate Tag',
    text: 'Lysosomal enzymes get a phosphate added to one of their mannose sugars, starting in the cis Golgi. M6P receptors in the trans-Golgi network read this tag and send the enzymes toward lysosomes. When the tagging enzyme is missing, as in I-cell disease, the enzymes are secreted out of the cell instead.',
    celiaLineId: 'cur_m6p_tag',
  },
  {
    id: 'cis_trans_signs',
    district: 'golgi',
    title: 'Cis and Trans Signage',
    text: 'Cis means “on this side” and trans “across”: the cis face looks toward the ER, the trans face toward the plasma membrane. Each cisterna holds a different set of enzymes, so sugar chains are modified in order, like stations on an assembly line.',
    celiaLineId: 'cur_cis_trans_signs',
  },
  // Mitochondria (3)
  {
    id: 'mtdna_ring',
    district: 'mitochondria',
    title: 'mtDNA Ring',
    text: 'Each mitochondrion keeps copies of its own small circular chromosome: 16,569 base pairs in humans, carrying 37 genes for 13 respiratory-chain proteins, 22 tRNAs and 2 rRNAs. It is a relic of the organelle’s bacterial ancestry, and it is inherited almost entirely from the mother.',
    celiaLineId: 'cur_mtdna_ring',
  },
  {
    id: 'krebs_roundabout',
    district: 'mitochondria',
    title: 'Krebs Roundabout',
    text: 'The citric acid cycle really is a roundabout: a two-carbon acetyl group joins four-carbon oxaloacetate, and eight steps later oxaloacetate comes back round. Each turn releases 2 CO₂ and loads 3 NADH, 1 FADH₂ and 1 GTP or ATP. Much of the CO₂ you breathe out leaves from here.',
    celiaLineId: 'cur_krebs_roundabout',
  },
  {
    id: 'atp_counter',
    district: 'mitochondria',
    title: 'ATP Truck Counter',
    text: 'Your body holds only about 250 grams of ATP at any moment, yet you make and use roughly your own body weight of it every day. Each ATP molecule is rebuilt from ADP hundreds of times a day.',
    celiaLineId: 'cur_atp_counter',
  },
  // Lysosomes (2)
  {
    id: 'autophagy',
    district: 'lysosomes',
    title: 'Autophagy',
    text: 'In autophagy (“self-eating”), a double-membraned autophagosome wraps up worn-out organelles or protein clumps and fuses with a lysosome. It ramps up during starvation, recycling the cell’s own parts for fuel and building blocks. Yoshinori Ohsumi won the 2016 Nobel Prize for uncovering its genes in yeast.',
    celiaLineId: 'cur_autophagy',
  },
  {
    id: 'ph_gauge',
    district: 'lysosomes',
    title: 'pH Gauge',
    text: 'The gauge reads about 4.5, a proton concentration several hundred times higher than in the cytosol at about pH 7.2. V-ATPase proton pumps hold it there, and the digestive enzymes inside barely work at neutral pH: a safety lock in case a lysosome leaks.',
    celiaLineId: 'cur_ph_gauge',
  },
  // Vacuoles (1)
  {
    id: 'rubber_duck',
    district: 'vacuoles',
    title: 'Rubber Duck',
    text: 'Definitely not an organelle. Still, natural rubber is a polymer of isoprene, and your cells build cholesterol from the same five-carbon isoprene units. Someone on the vacuole crew clearly has a sense of humour.',
    celiaLineId: 'cur_rubber_duck',
  },
  // Membrane (4)
  {
    id: 'aquaporin',
    district: 'membrane',
    title: 'Aquaporin',
    text: 'Aquaporins are channels that pass water molecules in single file, up to a few billion per second per channel, while blocking protons. They explain why membranes such as those of red blood cells and kidney cells are so permeable to water. Peter Agre shared the 2003 Nobel Prize in Chemistry for discovering them.',
    celiaLineId: 'cur_aquaporin',
  },
  {
    id: 'receptor_antenna',
    district: 'membrane',
    title: 'Receptor Antenna',
    text: 'This antenna is a G-protein-coupled receptor (GPCR), from the largest family of membrane receptors: humans have about 800 GPCR genes. They detect hormones, neurotransmitters, odours and even light, and roughly a third of approved drugs act on them.',
    celiaLineId: 'cur_receptor_antenna',
  },
  {
    id: 'peroxisome',
    district: 'membrane',
    title: 'Peroxisome Cameo',
    text: 'Peroxisomes are small single-membrane organelles that break down very-long-chain fatty acids and make special lipids such as plasmalogens, important in myelin. Their oxidation reactions produce hydrogen peroxide, which the enzyme catalase quickly splits into water and oxygen.',
    celiaLineId: 'cur_peroxisome',
  },
  {
    id: 'apoptosis_switch',
    district: 'membrane',
    title: '“Do Not Press”',
    text: 'Apoptosis is programmed cell death: a tidy self-dismantling that packages the cell up for disposal without spilling its contents or causing inflammation. Death receptors on the cell surface, or cytochrome c released from mitochondria, activate protein-cutting enzymes called caspases. An adult human removes tens of billions of cells this way every day.',
    celiaLineId: 'cur_apoptosis_switch',
  },
];

export const HELP = {
  controls: [
    { action: 'Move', keys: 'W A S D / Arrow keys, or left-click the ground' },
    { action: 'Run', keys: 'Shift' },
    { action: 'Rotate camera', keys: 'Q / E, or right-drag' },
    { action: 'Zoom', keys: 'Mouse wheel (scroll all the way out for the city overview)' },
    { action: 'First-person view', keys: 'V to toggle · click to look around with the mouse (Esc frees the cursor)' },
    { action: 'Interact / Examine', keys: 'E, or click a glowing object' },
    { action: 'Ask Dr. Celia', keys: 'G' },
    { action: 'Guided tour', keys: 'T' },
    { action: 'Labels', keys: 'L' },
    { action: 'Field notebook', keys: 'N' },
    { action: 'Help & settings', keys: 'H or ?' },
    { action: 'Back / Exit', keys: 'Esc' },
  ],
  note: 'This city is a model. Real cellular processes run far faster, in a far more crowded space, and at a far smaller scale; here they are slowed down and only some are shown, so you can see them clearly. The city metaphor (roads, trucks, workers) is an analogy; the science cards and labels are accurate.',
};
