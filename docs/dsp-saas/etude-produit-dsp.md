# Logiciel d'exploitation pour sous-traitants de livraison (DSP Amazon et transport léger)

Étude produit, marché, MVP, architecture et business model. Version 1, 29 septembre 2026.

## Comment lire ce document

Chaque donnée importante porte l'un de ces statuts :

| Statut | Signification |
|---|---|
| DONNÉE SOURCÉE [Sx] | Fait tiré d'une source listée en fin de document (section Sources). |
| ESTIMATION / HYPOTHÈSE | Raisonnement ou calcul de ma part. Les hypothèses sont écrites en clair pour être contestées. |
| À VALIDER | Information plausible mais non confirmée par une source fiable, ou qui doit être vérifiée sur le terrain (entretiens clients, avocat, Amazon). |

Limites de la recherche, à connaître avant de lire la suite :

- Une partie des sites (About Amazon France, Assemblée nationale, sites des concurrents, presse spécialisée) était bloquée par le proxy de l'environnement de travail. Pour ces pages, je n'ai eu accès qu'aux extraits des moteurs de recherche, pas au texte complet. Je le signale à chaque fois que c'est le cas.
- Je n'ai trouvé aucune source publique fiable sur Instapack (chiffre d'affaires, taille de flotte, organisation). Je ne l'utilise donc pas comme cas d'étude chiffré.
- Le fonctionnement interne d'un DSP est documenté surtout pour les États-Unis. Quand je transpose à la France, je l'indique.
- Rien ici ne constitue un avis juridique. Les points de droit cités renvoient aux textes, mais leur application à un cas précis doit passer par un avocat en droit social et un DPO.

---

## 1. Executive Summary

### Ce que je recommande en une page

1. Le problème est réel, mais pas là où on l'attend. Les DSP Amazon disposent déjà d'outils Amazon pour la partie "livraison" (affectation des tournées, application du livreur, scorecard hebdomadaire, télématique de conduite). Amazon vient d'annoncer (21 septembre 2026) un assistant IA agentique qui analyse la performance des DSP [S1]. Construire un énième tableau de bord de performance Amazon serait une erreur : c'est le terrain d'Amazon et de concurrents américains déjà installés (Hera à 9 $ par chauffeur actif et par mois [S11], DailyDSP, LMDmax, DSPLite [S12]).
2. Le vrai trou se situe dans les obligations d'employeur et de propriétaire de flotte, qu'Amazon ne couvre pas et ne couvrira probablement pas, parce que ce n'est pas son problème : dommages et sinistres, amendes et désignation du conducteur (45 jours, amende quintuplée pour une société [S18][S19]), validité des permis [S20], documents qui expirent, contrôle technique [S22], temps de travail des conducteurs de VUL (LIC ou Mobilic, obligatoire [S17]), préparation des variables de paie, coûts de la flotte. Ces sujets coûtent de l'argent directement et se gèrent aujourd'hui dans WhatsApp, Excel et des classeurs papier (À VALIDER par entretiens, mais cohérent avec les témoignages presse [S7]).
3. Le positionnement "sous-traitants Amazon" seul est trop étroit pour un SaaS. En France, Amazon revendique plus de 100 entreprises de livraison partenaires [S2] et cherchait environ 40 nouveaux partenaires avec des flottes de 20 à 40 véhicules [S3]. Même en prenant toute cette population, le parc adressable tourne autour de 3 000 à 6 000 véhicules (ESTIMATION / HYPOTHÈSE, détail en section 5). À 10 à 15 € par véhicule et par mois, 100 % de part de marché donnerait 0,4 à 1 M€ de revenu annuel. C'est une bonne base de départ, pas un marché suffisant.
4. Recommandation de positionnement : "le logiciel d'exploitation des sous-traitants de livraison en VUL", avec les DSP Amazon comme première cible (clients concentrés, processus homogènes, douleur forte), puis les sous-traitants de Chronopost, DPD, GLS, Colis Privé, Colissimo et le transport léger. Le produit doit être agnostique du donneur d'ordre dès la conception (import de fichiers, pas de dépendance à une API Amazon qui n'existe pas publiquement).
5. MVP (4 à 5 mois, 2 développeurs + 1 profil produit/terrain) : flotte et documents avec alertes, application chauffeur (inspection du véhicule avec photos, déclaration de dommage, prise et restitution du véhicule), gestion des dossiers dommages, registre des amendes avec workflow de désignation, planning du jour avec absences et remplacement assisté, journal d'audit, multi-tenant. Pas de GPS maison, pas de paie, pas d'optimisation de tournées, pas d'IA générative au lancement.
6. Business model : prix par véhicule actif (le véhicule est l'unité que le client comprend et qui porte les coûts), autour de 12 à 18 € HT par véhicule et par mois selon le forfait, avec un minimum mensuel. C'est une ESTIMATION / HYPOTHÈSE à valider par des entretiens de disposition à payer (méthode en section 21).
7. Risques majeurs : dépendance au bon vouloir d'Amazon (qui peut sortir un outil équivalent ou modifier les règles), fragilité financière des DSP (liquidations comme Fast Despatch Logistics en 2022 [S7], pression tarifaire documentée [S4]), petit marché français, cycle d'adoption par des dirigeants très pris. Le produit doit prouver un retour sur investissement chiffrable dès le premier mois.

### Verdict

Le projet est viable s'il est recadré : moins "gestion de flotte Amazon", plus "gestion des risques et obligations d'un employeur de livreurs". Il ne l'est pas sous sa forme initiale (un outil qui fait tout, centré sur Amazon, avec IA et GPS dès le départ). Avant d'écrire une ligne de code, il faut 15 à 20 entretiens avec des dirigeants et managers de DSP (Phase 1, section 20).

---

## 2. Problème identifié

### 2.1 Le contexte économique des DSP en France

| Fait | Statut |
|---|---|
| Amazon a lancé le programme "Partenaires de livraison" en 2018. | DONNÉE SOURCÉE [S1][S2] |
| Dans le monde, environ 4 500 propriétaires de DSP en 2025 selon Amazon. Plus de 3 500 DSP et 275 000 chauffeurs en 2022. | DONNÉE SOURCÉE [S1] (extraits aboutamazon.com) |
| En France, Amazon indique travailler avec plus de 100 entreprises de livraison indépendantes, en lien avec 27 agences de livraison de proximité. | DONNÉE SOURCÉE [S2], date de la page non vérifiée (page non consultable), donc À VALIDER pour 2026 |
| Amazon cherchait environ 40 nouveaux partenaires en France, avec des flottes de 20 à 40 véhicules en moyenne. | DONNÉE SOURCÉE [S3], date à confirmer |
| Investissement de départ évoqué autour de 25 000 €. | Source secondaire (Legalstart [S5]), À VALIDER |
| Depuis 2021, Amazon remplace une partie de ses transporteurs historiques par des "DSP 2.0" dédiés à 100 % à Amazon, rémunérés autour de 200 € par tournée contre plus de 270 € pour les partenaires historiques, soit environ 30 % moins cher. | DONNÉE SOURCÉE [S4] (L'Informé, extrait) |
| Un sous-traitant d'Amazon, Fast Despatch Logistics, a été liquidé en septembre 2022 (tribunal de commerce de Bobigny), environ 700 salariés touchés en France, salaires de juillet et août en grande partie impayés. | DONNÉE SOURCÉE [S7] |

Ce que ces faits impliquent pour le produit :

- Les DSP ont des marges faibles et un seul client qui fixe les prix. Un logiciel ne se vend que s'il fait économiser ou éviter des pertes mesurables. "Mieux organisé" ne suffit pas.
- La survie d'un DSP dépend de sa capacité à garder son contrat Amazon, donc de la performance (gérée par les outils Amazon) et de l'absence d'incidents graves (accidents, fraude, non-conformité sociale).
- Le churn client du SaaS sera structurellement élevé : un client peut disparaître parce qu'Amazon lui retire une station. Il faut l'intégrer au business plan (section 21).

### 2.2 Où se perdent le temps et l'argent

Je distingue ce qui est documenté de ce qui doit être confirmé en entretien.

| Douleur | Pourquoi elle coûte | Statut |
|---|---|---|
| Amendes et avis de contravention reçus par la société pour des véhicules conduits par des salariés | Obligation de désigner le conducteur sous 45 jours (art. L121-6 code de la route). À défaut, contravention de 4e classe dont le montant est quintuplé pour une personne morale (art. 131-41 code pénal), par exemple 675 € forfaitaire. | DONNÉE SOURCÉE [S18][S19] |
| Retrouver qui conduisait quel véhicule à une date et heure données | Sans historique fiable des affectations, la désignation est impossible ou fausse. | ESTIMATION / HYPOTHÈSE (conséquence logique de l'obligation ci-dessus) |
| Dommages aux véhicules découverts tard, sans photo ni auteur identifié | Coût de réparation non imputable à l'assureur ou au loueur dans de bonnes conditions, contestation avec le loueur au retour du véhicule. | À VALIDER (fréquence et montants inconnus) |
| Documents expirés (permis, assurance, contrôle technique) | Risque pénal, refus d'indemnisation, véhicule immobilisé en contrôle routier. | Mécanisme sourcé [S20][S22], fréquence À VALIDER |
| Temps de travail des conducteurs de VUL | Les conducteurs non soumis au chronotachygraphe (VUL de moins de 3,5 t) doivent tenir un livret individuel de contrôle ou utiliser Mobilic. | DONNÉE SOURCÉE [S17] |
| Absences de dernière minute et remplacement | Une tournée non couverte fait baisser la performance vis-à-vis d'Amazon. Dans les DSP américains, le turnover des chauffeurs est cité entre 100 et 150 % par an. | Turnover : source d'un vendeur de services de recrutement [S27], fiabilité faible. Situation France À VALIDER |
| Accidents du travail (dont accidents de la route pendant la tournée) | Déclaration à la CPAM sous 48 h, amende jusqu'à 3 750 € pour une personne morale en cas d'absence ou de retard. | DONNÉE SOURCÉE [S21] |
| Communication manager et chauffeurs par WhatsApp | Information perdue, aucune traçabilité, mélange vie privée et vie professionnelle. Des pratiques similaires (consignes par WhatsApp) sont rapportées chez GLS. | Rapporté [S28], généralisation À VALIDER |

### 2.3 Hypothèses fondamentales à tester avant tout développement

1. H1 : les dirigeants de DSP perdent de l'argent de manière identifiable sur les amendes, dommages et documents expirés. Mesure : montant annuel déclaré en entretien, idéalement vérifié sur leurs relevés.
2. H2 : ils utilisent aujourd'hui des outils bricolés (Excel, WhatsApp, Google Drive) et pas un logiciel de flotte. Mesure : outils cités spontanément.
3. H3 : ils sont prêts à imposer une application supplémentaire à leurs chauffeurs, qui ont déjà l'application Amazon et parfois Mentor. Risque : saturation d'applications. Mesure : réaction à une maquette cliquable.
4. H4 : le décideur (dirigeant) a un budget logiciel mensuel d'au moins 300 à 600 € pour une flotte de 30 véhicules. Mesure : questions de disposition à payer (section 21).
5. H5 : les sous-traitants d'autres donneurs d'ordre (Chronopost, DPD, GLS) ont les mêmes douleurs. Mesure : 5 entretiens hors Amazon.

Si H1 ou H3 tombe, le projet doit être revu.

---

## 3. Analyse des utilisateurs

Six profils. Dans un DSP de 20 à 40 véhicules, plusieurs rôles sont souvent tenus par la même personne (le dirigeant fait aussi le fleet manager, le responsable d'exploitation fait le planning). Le modèle de permissions doit donc permettre de cumuler des rôles sans créer un compte par casquette. ESTIMATION / HYPOTHÈSE fondée sur la taille des structures [S3].

### 3.1 Dirigeant / administrateur

| | |
|---|---|
| Besoins | Savoir en deux minutes si la journée tourne, combien coûte la flotte, où sont les risques (documents, sinistres, amendes en attente). |
| Problèmes | Information éparpillée, dépendance à un ou deux managers qui "savent tout", découverte tardive des problèmes. |
| Accès | Tout, y compris coûts, données RH, paramétrage, facturation de l'abonnement. |
| Actions | Créer les utilisateurs et rôles, valider les décisions sensibles (sortie d'un véhicule bloqué, clôture d'un sinistre coûteux), exporter. |
| Ne doit pas voir | Rien n'est interdit par principe, mais les données de santé ne doivent pas exister dans l'outil (un arrêt maladie est une absence, pas un diagnostic). |

### 3.2 Fleet manager

| | |
|---|---|
| Besoins | État de chaque véhicule, échéances, dommages, entretiens, carburant, relation avec loueurs, garages et assureur. |
| Problèmes | Véhicules loués (souvent en location longue durée, parfois via un programme de location négocié par Amazon selon des sources américaines, À VALIDER en France) dont il faut prouver l'état au retour, pannes en cours de tournée. |
| Accès | Flotte, dommages, carburant, amendes (pour la désignation), identité et permis des chauffeurs (pour l'affectation). |
| Actions | Bloquer ou débloquer un véhicule, ouvrir et suivre un dossier dommage, planifier un entretien, saisir des coûts. |
| Ne doit pas voir | Salaires, évaluations RH, motifs détaillés d'absence, documents personnels non liés à la conduite (pièce d'identité au-delà de ce qui est nécessaire, RIB). |

### 3.3 Responsable d'exploitation (dispatcher)

| | |
|---|---|
| Besoins | Savoir à 6 h 30 qui est là, qui manque, quel véhicule part avec qui, et remplacer vite. |
| Problèmes | Absences non prévenues, véhicule indisponible découvert au dernier moment, chauffeurs qui ne répondent pas. |
| Accès | Planning, présence du jour, disponibilité des véhicules, qualifications (catégorie de permis, formation spécifique), coordonnées professionnelles. |
| Actions | Affecter chauffeur et véhicule, marquer un retard ou une absence, lancer une demande de remplacement, envoyer un message à un groupe. |
| Ne doit pas voir | Coûts détaillés, salaires, documents RH, historique disciplinaire. |

### 3.4 Responsable RH / planning

| | |
|---|---|
| Besoins | Dossiers salariés complets, documents à jour, absences et congés, heures, préparation de la paie. |
| Problèmes | Pièces manquantes à l'embauche, turnover élevé qui multiplie les entrées et sorties, relances manuelles. |
| Accès | Dossiers salariés, absences, congés, temps de travail, formations, export paie. |
| Actions | Créer un salarié, valider un congé, relancer un document manquant, exporter les variables de paie. |
| Ne doit pas voir | Coûts de la flotte (non nécessaire), données de géolocalisation (si elles existent un jour). |

### 3.5 Chauffeur-livreur

| | |
|---|---|
| Besoins | Savoir quel véhicule prendre, faire l'inspection vite, signaler un problème sans appeler, poser un congé, recevoir ses documents. |
| Problèmes | Journée très chargée, beaucoup d'applications (Amazon, parfois Mentor [S13]), crainte d'être accusé d'un dommage qu'il n'a pas causé. |
| Accès | Son planning, son véhicule du jour et son historique récent, ses documents, ses déclarations, les consignes. |
| Actions | Prise en charge et restitution du véhicule, inspection, déclaration dommage ou accident, plein de carburant, demande d'absence, message au manager. |
| Ne doit pas voir | Données des autres chauffeurs, coûts, classement nominatif des collègues. |

Point de conception important : l'application doit aussi protéger le chauffeur. Les photos horodatées de l'inspection de départ prouvent l'état du véhicule au moment où il le prend. C'est un argument d'adoption côté chauffeur, pas seulement un outil de contrôle.

### 3.6 Comptabilité / administratif

| | |
|---|---|
| Besoins | Coûts par véhicule et par mois, justificatifs (tickets carburant, factures de réparation), suivi des refacturations (assureur, loueur, tiers responsable). |
| Problèmes | Tickets perdus, factures non rapprochées, coûts d'un sinistre dispersés. |
| Accès | Coûts, factures, justificatifs, exports comptables. |
| Actions | Valider une dépense, rattacher un justificatif, exporter vers l'outil comptable. |
| Ne doit pas voir | Dossiers RH détaillés, inspections (sauf pour justifier un coût). |

### 3.7 Profils oubliés dans la demande initiale

- Chef d'équipe / "lead driver" : un chauffeur expérimenté qui aide le dispatcher. Il faut un rôle intermédiaire (voir le planning du jour, pas les données RH). À VALIDER en entretien.
- Groupe multi-sociétés : un actionnaire qui détient plusieurs DSP veut une vue consolidée. Voir section 9.4.
- Tiers externes en lecture limitée : garage, expert, loueur, courtier en assurance. Un lien sécurisé à durée limitée vers un dossier dommage évite des dizaines d'e-mails. V2.

---

## 4. Analyse du fonctionnement d'un DSP

### 4.1 Le modèle

Un DSP est une PME de transport léger qui livre exclusivement ou principalement pour Amazon depuis une agence de livraison Amazon ("delivery station"). Amazon fournit le volume, l'image de marque (véhicules et tenues) et des outils ; le DSP recrute, forme et encadre les chauffeurs et gère les véhicules [S3][S5]. En France, un DSP est une entreprise de transport pour compte d'autrui avec des VUL de moins de 3,5 t, ce qui implique l'inscription au registre des transporteurs et une capacité professionnelle en transport léger (DONNÉE SOURCÉE, fiches Bpifrance Création et Adie citées par la recherche [S29]).

Outils fournis ou imposés par Amazon, d'après les sources disponibles :

| Outil | Rôle | Statut |
|---|---|---|
| Cortex | Outil Amazon où le DSP voit le volume du jour et les zones attribuées, et affecte les tournées. | Sources de vendeurs tiers [S12], détail des fonctions en France À VALIDER |
| Application de livraison Amazon (Amazon Delivery App) | Navigation, scans, preuve de livraison. | DONNÉE SOURCÉE [S1] |
| Scorecard hebdomadaire | Indicateurs de qualité et de sécurité du DSP (taux de livraison réussie DCR, colis déclarés non reçus DNR, photo à la livraison POD, conformité aux procédures, etc.) et paliers de performance ("Fantastic Plus", "Fantastic", "Great", etc.). | Sources de vendeurs tiers [S12], liste exacte des indicateurs en Europe À VALIDER |
| Mentor (eDriving) ou Netradyne | Mesure du comportement de conduite (freinages, accélérations, distraction). Netradyne annonçait son arrivée en France en 2023. | DONNÉE SOURCÉE [S13] |
| Assistant IA pour analyser la performance du DSP | Annoncé le 21 septembre 2026, périmètre géographique non précisé dans les extraits (probablement États-Unis d'abord). | DONNÉE SOURCÉE [S1], disponibilité en France À VALIDER |

### 4.2 Une journée type

Reconstituée à partir de sources américaines [S12] et transposée. Chaque étape doit être vérifiée en observant une vraie station française (Phase 1). Statut global : À VALIDER.

| Heure (indicative) | Étape | Données produites | Qui les détient aujourd'hui |
|---|---|---|---|
| Veille au soir | Amazon publie le volume et les tournées prévues. Le DSP prépare le roster (qui travaille demain). | Nombre de tournées, liste des chauffeurs | Cortex (Amazon), Excel ou outil tiers |
| 6 h 00 à 7 h 00 | Arrivée des chauffeurs, pointage, contrôle des absences. | Présence, retards | Papier, WhatsApp, parfois Mobilic |
| 6 h 30 à 7 h 30 | Affectation véhicule, remise des clés, téléphone, inspection avant départ. | Affectation véhicule-chauffeur, état du véhicule, photos | Papier ou outil Amazon selon pays (À VALIDER), souvent rien de fiable |
| 7 h 00 à 8 h 00 | Chargement à la station, départ en tournée. | Heure de départ | Outils Amazon |
| Journée | Livraisons, incidents, pannes, accidents, "rescues" (un autre chauffeur reprend une partie de la tournée). | Événements, appels | Amazon (livraison), téléphone et WhatsApp (le reste) |
| Journée | Plein de carburant, parfois recharge électrique. | Ticket, montant, kilométrage | Carte carburant, ticket papier |
| Fin de tournée | Retour à la station, colis non livrés rendus, retour au parking. | Kilométrage, état du véhicule, dommages éventuels | Rarement saisi de façon structurée |
| Soir | Restitution du véhicule, rendu des clés et du téléphone, fin de journée. | Heure de fin, temps de travail | LIC papier ou Mobilic |
| Hebdomadaire | Réception de la scorecard, coaching des chauffeurs. | Indicateurs | Amazon, outils tiers |
| Mensuel | Paie, factures loueur, carburant, amendes reçues. | Coûts | Comptable, Excel |

Observation clé : tout ce qui concerne la livraison du colis est tracé par Amazon. Tout ce qui concerne le véhicule, le salarié et les coûts est mal tracé. C'est là que se trouve la place d'un logiciel tiers.

### 4.3 Analyse thème par thème

| Thème | Situation probable | Opportunité logiciel | Statut |
|---|---|---|---|
| Chauffeurs | Turnover élevé, beaucoup d'entrées et sorties, documents d'embauche à collecter. | Onboarding mobile (le salarié envoie ses pièces depuis son téléphone), relances automatiques. | À VALIDER |
| Véhicules | Flotte louée, souvent homogène, parfois véhicules électriques. | Fiche véhicule, échéances, état au départ et au retour. | Partiellement sourcé [S5] |
| Départs en tournée | Moment le plus tendu de la journée, tout se joue en 60 à 90 minutes. | Écran "matin" : présents, manquants, véhicules prêts, affectations en un coup d'œil. | ESTIMATION / HYPOTHÈSE |
| Retours de tournée | Dommages souvent découverts ici ou le lendemain. | Inspection de retour obligatoire avec photos. | À VALIDER |
| Absences et remplacements | Absences non prévenues, remplaçants cherchés au téléphone. | Liste des remplaçants possibles, message groupé, confirmation. | À VALIDER |
| Incidents, accidents, dommages | Constat amiable papier, photos dans les galeries personnelles, suivi dans la tête du manager. | Dossier structuré, statuts, pièces jointes, coûts. | À VALIDER |
| Carburant | Cartes carburant (TotalEnergies, DKV, etc.) avec relevés de transactions [S24]. | Import des relevés, rapprochement avec le kilométrage, détection d'anomalies. | Mécanisme sourcé [S24] |
| Kilomètres | Relevé manuel, parfois lu par le loueur ou la télématique constructeur. | Saisie à l'inspection (avec photo du compteur), contrôle de cohérence. | ESTIMATION / HYPOTHÈSE |
| Entretien | Souvent inclus dans la location longue durée, à planifier avec le loueur. | Échéances, immobilisations, historique. | À VALIDER |
| Contrôles des véhicules | Contrôle technique à 4 ans puis tous les 2 ans pour les VUL, plus un contrôle complémentaire pollution. | Alertes d'échéance. | DONNÉE SOURCÉE [S22] |
| Documents administratifs | Permis, carte grise, assurance, attestations, contrats. | Coffre-fort documentaire avec dates d'expiration. | ESTIMATION / HYPOTHÈSE |
| Assurances | Flotte assurée, franchises, sinistralité qui influence la prime. | Suivi de la sinistralité, dossiers complets pour l'assureur. | À VALIDER |
| Amendes et infractions | Avis reçus par la société, désignation du conducteur obligatoire. | Registre des avis, retrouver le conducteur, suivre le délai de 45 jours. | DONNÉE SOURCÉE [S18] |
| Performances des chauffeurs | Mesurées par Amazon (scorecard) et par la télématique de conduite. | Ne pas recréer. Au plus, lier un incident interne à un chauffeur. | Voir section 7 |
| Indicateurs opérationnels | Dans les outils Amazon. | Indicateurs internes : coûts, taux d'immobilisation, sinistralité, absentéisme. | ESTIMATION / HYPOTHÈSE |
| Problèmes administratifs | Pièces manquantes, relances, échéances. | Automatisation des relances. | ESTIMATION / HYPOTHÈSE |
| Communication manager-chauffeurs | WhatsApp. | Messages et consignes dans l'application, avec accusé de lecture. Attention : ne pas essayer de remplacer WhatsApp pour tout, c'est perdu d'avance. | ESTIMATION / HYPOTHÈSE |

### 4.4 Tâches répétitives automatisables

Relances de documents manquants ou expirant, calcul des échéances de contrôle technique, rapprochement des tickets carburant, identification du conducteur pour un avis de contravention, pré-remplissage des formulaires de désignation, liste des remplaçants disponibles, rapport hebdomadaire des coûts et incidents, export des variables de paie, génération du dossier sinistre pour l'assureur. Le détail est en section 14.

---

## 5. Analyse du marché

### 5.1 Taille du marché : le calcul honnête

Méthode ascendante (bottom-up), car aucune étude publique ne chiffre le marché des logiciels pour DSP en France.

| Hypothèse | Valeur | Statut |
|---|---|---|
| Entreprises partenaires de livraison d'Amazon en France | Plus de 100 [S2], plus environ 40 recherchées [S3]. Les deux chiffres ne sont pas datés précisément et peuvent se recouvrir. | Sourcé mais daté de façon incertaine. Retenu : 100 à 150. ESTIMATION / HYPOTHÈSE |
| Véhicules par entreprise | 20 à 40 en moyenne pour les nouveaux partenaires [S3]. Les partenaires historiques peuvent être plus gros. | Retenu : 30 à 40. ESTIMATION / HYPOTHÈSE |
| Parc total | 100 × 30 = 3 000 à 150 × 40 = 6 000 véhicules | ESTIMATION / HYPOTHÈSE |
| Prix moyen | 12 à 15 € HT par véhicule et par mois | ESTIMATION / HYPOTHÈSE (section 21) |
| Revenu annuel à 100 % de part de marché | 3 000 × 12 × 12 = 432 k€ à 6 000 × 15 × 12 = 1,08 M€ | ESTIMATION / HYPOTHÈSE |
| Part de marché réaliste à 3 ans | 15 à 30 % | ESTIMATION / HYPOTHÈSE |
| Revenu annuel réaliste, DSP Amazon France seuls | 65 k€ à 320 k€ | ESTIMATION / HYPOTHÈSE |

Conclusion : les DSP Amazon en France suffisent pour valider le produit et atteindre un premier seuil de rentabilité modeste (un ou deux salariés), pas pour construire une entreprise de logiciel de taille significative. Ce constat est central pour la suite.

### 5.2 Élargir : qui d'autre a les mêmes douleurs

| Segment | Arguments | Réserves | Statut |
|---|---|---|---|
| Sous-traitants de Chronopost, Colissimo (La Poste) | Chronopost sous-traite une large part de ses tournées urbaines (85 à 100 % selon les sites étudiés entre 2019 et 2021). | Données d'une étude universitaire sur quelques sites, pas une statistique nationale. | DONNÉE SOURCÉE [S28] |
| Sous-traitants de DPD | DPD mentionnait environ 110 sous-traitants employant 750 chauffeurs (périmètre non précisé). | Idem, contexte à vérifier. | DONNÉE SOURCÉE [S28] |
| Sous-traitants de GLS, Colis Privé, UPS, FedEx, DHL | Même modèle économique de sous-traitance de tournées, souvent mêmes entreprises multi-donneurs d'ordre. | Pas de chiffres fiables trouvés. | À VALIDER |
| Transport léger en général (messagerie, courses, livraison B2B) | Mêmes obligations (VUL, LIC ou Mobilic, amendes, dommages). | Moins homogène, besoins de planification différents. | Obligations sourcées [S17] |
| Livraison alimentaire (épiceries en ligne, traiteurs, grossistes) | Flotte VUL, chauffeurs salariés. | Contraintes spécifiques (froid, créneaux), souvent intégrées à l'ERP du distributeur. | À VALIDER |
| Plateformes de livraison repas à vélo | Hors cible : pas de véhicules, statuts d'indépendants, problématiques différentes. | À écarter. | ESTIMATION / HYPOTHÈSE |
| DSP dans d'autres pays européens (Royaume-Uni, Allemagne, Espagne, Italie) | Même programme Amazon, même logique. | Réglementation locale différente (temps de travail, amendes, RGPD appliqué différemment). Concurrents locaux (DSPilot au Royaume-Uni [S12]). | À VALIDER |

Volume du marché du colis en France pour situer l'ensemble : 1,7 milliard de colis distribués en France et à l'export en 2024, pour 10,0 Md€ HT de revenu (Arcep) [S8]. Il n'existe pas, à ma connaissance, de statistique publique sur le nombre d'entreprises sous-traitantes de livraison de colis. Le registre des entreprises de transport (DREAL) serait la bonne source pour compter les entreprises de transport léger. À VALIDER.

Recommandation : concevoir le produit pour "les sous-traitants de livraison en VUL", commencer la commercialisation par les DSP Amazon, puis ouvrir aux sous-traitants multi-donneurs d'ordre. Beaucoup de sous-traitants travaillent pour plusieurs donneurs d'ordre (À VALIDER), ce qui rend un outil agnostique encore plus utile pour eux.

### 5.3 Ce que le client paie déjà (repères de prix)

| Solution | Prix public ou estimé | Unité | Statut |
|---|---|---|---|
| Fleetio (gestion de flotte, États-Unis) | 4 $ (Essential), 7 $ (Professional), 10 $ (Premium) | Par véhicule et par mois, annuel, minimum 5 véhicules | DONNÉE SOURCÉE [S9] |
| Samsara (télématique et flotte) | 27 à 33 $ pour le logiciel, 40 à 60 $ avec options, boîtier 99 à 148 $ | Par véhicule et par mois, engagement 1 à 3 ans | Estimations tierces, prix non publiés [S10] |
| Hera (logiciel spécialisé DSP Amazon, États-Unis) | 9 $ | Par chauffeur actif et par mois, toutes fonctions | DONNÉE SOURCÉE [S11] |
| Logiciels de flotte en France (avec boîtier) | 8 à 28 € | Par véhicule et par mois | Comparatif commercial [S26], fiabilité moyenne |
| Mobilic | Gratuit | Outil public | DONNÉE SOURCÉE [S17] |

---

## 6. Analyse de la concurrence

### 6.1 Cartographie

| Catégorie | Exemples | Ce qu'ils font bien | Limites pour un DSP français |
|---|---|---|---|
| Outils Amazon | Cortex, Amazon Delivery App, scorecard, assistant IA annoncé en 2026 [S1] | Gratuits pour le DSP, données de première main, imposés. | Ne gèrent ni la flotte côté employeur, ni les obligations RH et sociales françaises, ni les coûts. |
| Logiciels spécialisés DSP (États-Unis, Royaume-Uni) | Hera [S11], DailyDSP, LMDmax, DSPLite, Nizod, DSPilot (Royaume-Uni) [S12] | Connaissance fine d'Amazon, import des fichiers scorecard, planning, coaching, parfois inspection des véhicules. | En anglais, pensés pour le droit américain ou britannique, centrés sur la performance Amazon (terrain de plus en plus occupé par Amazon lui-même). Présence en France non constatée (À VALIDER). |
| Gestion de flotte généraliste internationale | Fleetio [S9], Samsara [S10], Geotab, Motive | Très complets sur véhicule, entretien, carburant. Samsara et Motive sur la télématique. | Pas de gestion du personnel ni du planning. Samsara et Motive chers et orientés poids lourds américains. |
| Gestion de flotte française | Fleeti, Optimum Automotive, GAC Technology, et d'autres [S24][S26] | Conformité française, intégrations cartes carburant (TotalEnergies, Shell, AS24, DKV, UTA [S24]), fiscalité des véhicules. | Pensés pour des flottes de véhicules de service ou de fonction, pas pour une rotation quotidienne de chauffeurs sur des véhicules partagés. Planning et remplacement absents (À VALIDER produit par produit). |
| SIRH et paie | Silae, PayFit, Eurécia, Combo, Skello (planning) | Paie, absences, planning horaire. | Pas de véhicule, pas de dommages, pas d'amendes. Planning pensé pour la restauration ou le commerce, pas pour l'affectation véhicule-tournée. |
| Temps de travail transport léger | Mobilic (public, gratuit) [S17], logiciels partenaires | Conformité réglementaire, gratuit. | Ne fait que le temps de travail. |
| Bricolage | Excel, Google Sheets, WhatsApp, Google Drive | Gratuit, connu de tous, flexible. | Aucune alerte, aucune traçabilité, dépend d'une personne. C'est le vrai concurrent. |

### 6.2 Tableau comparatif sur les besoins identifiés

Légende : Oui / Partiel / Non / ? (non vérifié). Les colonnes concurrents sont fondées sur les descriptions publiques trouvées ; elles doivent être vérifiées par des démonstrations (À VALIDER).

| Besoin | Outils Amazon | Hera et DSP US | Fleetio | Flotte FR | SIRH | Cible |
|---|---|---|---|---|---|---|
| Performance Amazon (scorecard) | Oui | Oui | Non | Non | Non | Non (volontairement) |
| Fiche véhicule, échéances, documents | Non | Partiel | Oui | Oui | Non | Oui |
| Inspection mobile avec photos | ? | Partiel | Oui | Partiel | Non | Oui |
| Dossier dommage et sinistre de bout en bout | Non | Partiel | Partiel | Partiel | Non | Oui |
| Historique affectation véhicule-chauffeur fiable | ? | Partiel | Partiel | Partiel | Non | Oui |
| Amendes et désignation du conducteur (droit français) | Non | Non | Non | Partiel (?) | Non | Oui |
| Permis, documents salariés, relances | Non | Partiel | Non | Non | Partiel | Oui |
| Planning du jour, absences, remplacement | Partiel (Cortex) | Oui | Non | Non | Partiel | Oui |
| Temps de travail conforme (Mobilic) | Non | Non | Non | ? | ? | Oui via API Mobilic |
| Export variables de paie françaises | Non | Non | Non | Non | Oui | Oui (export) |
| Coûts par véhicule et par km | Non | Partiel | Oui | Oui | Non | Oui |
| En français, hébergement UE | Partiel | Non | Non | Oui | Oui | Oui |

### 6.3 Menace principale : Amazon lui-même

Amazon investit massivement dans les outils du DSP (1,9 Md$ supplémentaires annoncés pour 2027, outils IA, assistant agentique [S1]). Tout ce qui touche à la performance de livraison et à l'analyse des données Amazon risque d'être absorbé par Amazon. Il est beaucoup moins probable qu'Amazon développe un outil de gestion des amendes françaises, des dossiers salariés ou des variables de paie de ses sous-traitants, pour une raison juridique : plus Amazon gère le personnel de ses sous-traitants, plus il s'expose à une requalification ou à une mise en cause comme employeur de fait. C'est une ESTIMATION / HYPOTHÈSE de ma part, mais elle est cohérente avec le principe de solidarité financière du donneur d'ordre en matière de travail dissimulé rappelé par l'Urssaf (recherche [S30]). Cette frontière est la meilleure protection du produit.

---

## 7. Opportunités de différenciation

### 7.1 Ce qu'il ne faut pas faire

| Idée | Pourquoi l'éviter |
|---|---|
| Tableau de bord de la scorecard Amazon | Occupé par Amazon (assistant IA 2026 [S1]) et par Hera, DailyDSP, LMDmax, etc. Dépend de fichiers Amazon dont le format et les conditions d'usage peuvent changer. |
| Récupération automatique des données Amazon par robot (scraping des portails) | Pas d'API publique connue pour les DSP. Les conditions d'utilisation d'Amazon interdisent en général l'extraction automatisée et le contournement des portails (politique fournisseurs de solutions Amazon, par analogie [S31]). Le risque est de faire perdre son contrat à un client. |
| Optimisation de tournées | Amazon calcule les tournées. Pour les autres donneurs d'ordre aussi, les tournées sont souvent imposées. Coût de développement élevé, valeur faible pour la cible. |
| Boîtier GPS propriétaire | Métier de matériel, capital important, contraintes CNIL fortes [S14]. Beaucoup de VUL récents ont une télématique constructeur accessible par API [S25]. |
| Paie complète | Métier réglementé, lourd, déjà couvert (Silae, PayFit). Un export propre des variables vaut mieux. |

### 7.2 Propositions différenciantes

1. "Qui conduisait quoi, quand" irréfutable. Chaque prise et restitution de véhicule est horodatée, photographiée, signée dans l'application. C'est la base de trois gains : désignation des amendes, imputation des dommages, preuve face au loueur. Aucun concurrent identifié n'en fait le cœur du produit.
2. Module amendes conforme au droit français : saisie de l'avis (photo ou PDF), identification automatique du conducteur à partir de l'historique, compte à rebours des 45 jours, génération des informations nécessaires à la désignation en ligne sur le site de l'ANTAI, preuve de désignation archivée. Le gain se calcule immédiatement : une non-désignation coûte 675 € en forfaitaire pour une société [S19]. C'est l'argument de vente le plus simple.
3. Dossier dommage de bout en bout, de la photo du chauffeur à la facture du garage, avec coûts et refacturation (assureur, tiers, loueur). Attention au piège juridique : l'employeur ne peut pas retenir le coût d'un dommage sur le salaire au titre d'une sanction, car les sanctions pécuniaires sont interdites (art. L1331-2 du code du travail). La responsabilité pécuniaire du salarié n'est admise qu'en cas de faute lourde selon la jurisprudence (À VALIDER avec un avocat). Le logiciel ne doit donc pas proposer de "retenue sur salaire pour dommage". C'est aussi un argument de sérieux vis-à-vis des chauffeurs et de l'inspection du travail.
4. Conformité "prêt pour un contrôle" : un écran qui montre, pour chaque chauffeur et chaque véhicule, si tout est en règle (permis vérifié, documents valides, temps de travail enregistré via Mobilic, contrôle technique à jour). Une entreprise de transport qui subit un contrôle DREAL, Urssaf ou une demande du donneur d'ordre sort un dossier en quelques clics.
5. Intégration Mobilic plutôt que pointage maison. L'API Mobilic permet aux logiciels métier de transmettre et lire les données de temps de travail, avec autorisation de l'entreprise [S17]. Cela évite de créer un deuxième système de pointage qui entrerait en conflit avec l'outil officiel. Aucun concurrent spécialisé DSP identifié ne l'annonce (À VALIDER sur la liste des partenaires Mobilic).
6. Agnostique du donneur d'ordre. Le planning et les tournées se saisissent ou s'importent (CSV, Excel) quel que soit le donneur d'ordre. Un sous-traitant qui travaille pour Amazon le matin et pour un autre réseau l'après-midi a un seul outil.
7. Application chauffeur qui protège le chauffeur : preuve de l'état du véhicule à la prise en charge, accès à ses propres documents, demande d'absence tracée. Cela facilite l'adoption, qui est le risque numéro un (H3).

---

## 8. Liste complète des fonctionnalités

Classement : Indispensable (MVP), Importante (V2), Optionnelle (V3), Inutile pour le MVP ou à ne pas faire. Le détail valeur, difficulté et coût est en section 19.

### 8.1 Flotte

| Fonction | Classement | Commentaire critique |
|---|---|---|
| Fiche véhicule : immatriculation, VIN, marque, modèle, année, type, énergie, statut | Indispensable | Décodage du VIN automatique : optionnel, la saisie est rapide pour 30 véhicules. |
| Kilométrage initial, actuel, historique | Indispensable | Alimenté par les inspections (photo du compteur). Refuser une valeur inférieure à la précédente sans validation. |
| Chauffeur affecté actuellement et historique des affectations | Indispensable | Cœur du produit (voir 7.2). |
| Documents du véhicule avec dates d'expiration | Indispensable | Carte grise, assurance, contrôle technique, contrat de location. |
| Statut et immobilisations (dates, motif, durée) | Indispensable | Un véhicule immobilisé ne doit pas pouvoir être affecté. |
| Dommages, sinistres, accidents liés au véhicule | Indispensable | Via le module dommages. |
| Photos | Indispensable | Rattachées aux inspections et dommages, pas une galerie libre. |
| Entretiens, réparations, pneus | Importante | Beaucoup de véhicules sont en location avec entretien inclus. La valeur est moindre qu'on ne le pense (À VALIDER). Version simple au MVP : "intervention" avec date, type, coût, garage. |
| Plan d'entretien préventif (tous les X km ou X mois) | Importante | V2. |
| Consommation, carburant, coûts | Importante | Voir module carburant. |
| Coût total par véhicule, coût au kilomètre | Importante | V2, dépend de la qualité des coûts saisis. |
| Suivi pneus détaillé (position, usure, marque) | Optionnelle | Rapport valeur/coût faible pour des VUL en location. |

### 8.2 Carburant

| Fonction | Classement | Commentaire |
|---|---|---|
| Saisie d'un plein par le chauffeur (photo du ticket, kilométrage, montant, litres) | Importante | La saisie manuelle par le chauffeur est le point faible : oublis, erreurs. Utile surtout pour les entreprises sans carte carburant. |
| Import des relevés de cartes carburant (CSV fournis par les émetteurs) | Importante | Plus fiable que la saisie. Les émetteurs mettent à disposition des relevés de transactions [S24]. |
| Consommation moyenne, coût au km, coût mensuel, coût par véhicule | Importante | V2. |
| Détection d'anomalies (voir 14.2) | Importante | V2, après 2 à 3 mois de données. |
| OCR du ticket de caisse | Optionnelle | V3. L'import des relevés de carte rend l'OCR peu utile. |

Point critique : pour calculer une consommation en L/100 km, il faut le kilométrage à chaque plein. Si les pleins passent par une carte carburant, le kilométrage saisi au terminal est souvent faux ou absent (À VALIDER). Le produit doit donc croiser le relevé de carte avec les kilométrages des inspections quotidiennes, pas se fier au kilométrage saisi à la pompe. Pour les véhicules électriques, il faut raisonner en kWh/100 km et en coût de recharge, avec des sources de données différentes (bornes, dépôt). À traiter en V2.

### 8.3 Dommages et accidents

| Fonction | Classement |
|---|---|
| Déclaration mobile en 7 étapes (véhicule, type, photos, description, localisation facultative, date et heure automatiques, envoi) | Indispensable |
| Notification immédiate au manager | Indispensable |
| Statuts : nouveau, en cours, réparateur contacté, réparation planifiée, véhicule immobilisé, réparé, clôturé | Indispensable |
| Historique complet, commentaires, pièces jointes (constat, devis, facture) | Indispensable |
| Coûts du dossier (devis, facture, franchise, remboursement) | Importante (V2) |
| Constat amiable guidé (aide au remplissage, photos du constat papier) | Importante (V2) |
| Lien de partage sécurisé pour l'expert ou le garage | Importante (V2) |
| Déclaration d'accident du travail : rappel du délai de 48 h et checklist | Importante (V2) [S21] |
| Estimation automatique du coût de réparation à partir des photos | À ne pas faire au début (voir section 15) |

Je propose d'ajouter deux statuts : "en attente d'expertise" et "refacturation en cours". Le statut "véhicule immobilisé" n'est pas une étape du dossier mais un état du véhicule ; il vaut mieux le gérer à part (un dossier peut ne pas immobiliser le véhicule, un véhicule peut être immobilisé sans dossier dommage).

### 8.4 Personnel

| Fonction | Classement | Commentaire |
|---|---|---|
| Identité, coordonnées, poste, date d'embauche, statut, type de contrat | Indispensable | |
| Permis : numéro, catégories, date d'expiration, photo recto verso | Indispensable | |
| Vérification de validité du permis via le téléservice de l'État | Importante (V2, procédure manuelle guidée au MVP) | Le téléservice verif.permisdeconduire.gouv.fr est ouvert aux employeurs du transport public routier de marchandises, pour la validité seulement (pas le solde de points), avec une participation financière [S20]. Aucune API publique identifiée : le logiciel peut rappeler la vérification et stocker la date et le résultat. À VALIDER. |
| Documents salariés avec expirations | Indispensable | |
| Véhicule affecté, historique | Indispensable | Vue inverse de la flotte. |
| Absences, congés, retards | Indispensable | Sans motif médical. |
| Disponibilités déclarées | Importante (V2) | |
| Historique des tournées | Importante (V2) | Dépend de l'import des tournées. |
| Incidents rattachés | Indispensable | Via dommages et amendes. |
| Formations et habilitations | Importante (V2) | Utile pour le remplacement (qualification requise). |
| Évaluations | Optionnelle | Terrain sensible (voir RGPD et droit du travail). À ne pas développer sans demande claire. |
| Onboarding mobile (le futur salarié envoie ses pièces) | Importante (V2) | Fort gain de temps si le turnover est élevé. |
| Paie | À ne pas faire | Export des variables vers Silae ou autre à la place [S23]. |

### 8.5 Présence, absences, planning

| Fonction | Classement |
|---|---|
| Vue "aujourd'hui" : présents, absents, congés, malades (sans motif médical), retards, à remplacer | Indispensable |
| Calendrier semaine et mois | Indispensable |
| Affectation chauffeur, véhicule, tournée ou zone | Indispensable |
| Import de la liste des tournées du jour (CSV ou Excel) | Indispensable |
| Aide au remplacement (liste classée des remplaçants possibles) | Indispensable |
| Demande de remplacement envoyée aux candidats avec réponse en un clic | Importante (V2) |
| Règles de temps de travail (repos, amplitude) prises en compte dans les suggestions | Importante (V2), dépend de Mobilic |
| Planning prévisionnel automatique | Optionnelle (V3) |

### 8.6 Application chauffeur

Voir section 12.

### 8.7 Inspection du véhicule

| Fonction | Classement |
|---|---|
| Checklist paramétrable par type de véhicule | Indispensable |
| Pour chaque point : conforme, problème, photo | Indispensable |
| Photos obligatoires minimales (4 faces et compteur) | Indispensable |
| Gravité des problèmes (mineur, à surveiller, bloquant) | Indispensable |
| Blocage de l'affectation en cas de problème bloquant jusqu'à validation du manager | Indispensable |
| Inspection de retour | Indispensable |
| Comparaison automatique des photos départ et retour | À ne pas faire au MVP (voir section 15) |

### 8.8 Documents et conformité

| Fonction | Classement |
|---|---|
| Stockage centralisé (véhicule, salarié, entreprise) | Indispensable |
| Type de document, date de délivrance, date d'expiration | Indispensable |
| Alertes à plusieurs niveaux (90, 30, 15, 7 jours, expiré) paramétrables | Indispensable |
| Listes "expirés" et "bientôt expirés" | Indispensable |
| Demande de document au salarié via l'application | Importante (V2) |
| Documents de l'entreprise (licence de transport, attestation Urssaf de vigilance, Kbis, assurance) avec expiration | Importante (V2) |
| Lecture automatique des dates d'expiration sur la photo du document | Optionnelle (V3) |

### 8.9 Amendes et infractions (ajout)

| Fonction | Classement |
|---|---|
| Saisie d'un avis de contravention (photo ou PDF, date, heure, lieu, immatriculation) | Indispensable |
| Identification automatique du conducteur à partir de l'historique d'affectation | Indispensable |
| Compte à rebours de 45 jours et alertes | Indispensable |
| Informations prêtes à recopier pour la désignation en ligne, preuve de désignation archivée | Indispensable |
| Notification au salarié désigné | Importante (V2) |
| Statistiques d'infractions par chauffeur | Optionnelle, sensible (voir RGPD) |

### 8.10 Tournées

| Fonction | Classement |
|---|---|
| Liste des tournées du jour saisie ou importée | Indispensable |
| Heures de départ et de retour | Importante (V2) |
| Nombre de colis, arrêts | Optionnelle (dépend des fichiers disponibles) |
| Optimisation, suivi temps réel | À ne pas faire |

### 8.11 Transverse

Multi-tenant, rôles et permissions, journal d'audit, notifications (application, e-mail), exports CSV, recherche globale : indispensables. SMS, API publique, SSO : V2 ou V3.

---

## 9. Architecture fonctionnelle

### 9.1 Modules et dépendances

```
                     +---------------------+
                     |  Référentiel        |
                     |  Société, dépôts,   |
                     |  utilisateurs, rôles|
                     +----------+----------+
                                |
      +-------------+-----------+-----------+--------------+
      |             |                       |              |
+-----v-----+ +-----v------+         +------v-----+ +------v------+
| Flotte    | | Personnel  |         | Documents  | | Audit log   |
| véhicules | | salariés   |<------->| échéances  | | (tout)      |
+-----+-----+ +-----+------+         +------+-----+ +-------------+
      |             |                       |
      +------+------+                       |
             |                              |
      +------v-------+                      |
      | Affectations |  <- cœur : qui, quel véhicule, quand
      +------+-------+                      |
             |                              |
  +----------+----------+-----------+       |
  |          |          |           |       |
+-v------+ +-v-------+ +v--------+ +v-------v--+
|Inspect.| |Dommages | |Amendes  | |Planning   |
|        | |sinistres| |         | |absences   |
+--------+ +---------+ +---------+ +-----------+
             |                          |
       +-----v-----+              +-----v------+
       | Coûts     |              | Export paie|
       | carburant |              | Mobilic    |
       +-----------+              +------------+
                 \                /
               +--v--------------v--+
               | Alertes, notifs,   |
               | rapports           |
               +--------------------+
```

Le module Affectations est central : chaque affectation est un intervalle de temps (début, fin) qui lie un chauffeur, un véhicule et éventuellement une tournée. Les inspections ouvrent et ferment ces intervalles. Les amendes et les dommages sont résolus en cherchant l'intervalle qui contient leur date et heure.

### 9.2 Objets principaux (modèle conceptuel, pas le schéma final)

| Objet | Attributs essentiels | Relations |
|---|---|---|
| Organisation (tenant) | raison sociale, SIREN, licence de transport, abonnement | a des sociétés si groupe |
| Dépôt / agence | nom, adresse, donneur d'ordre principal | appartient à une organisation |
| Utilisateur | identité, rôles, dépôts autorisés | peut être lié à un salarié |
| Salarié | identité, contrat, permis, statut | documents, absences, affectations |
| Véhicule | immatriculation, VIN, modèle, énergie, statut, propriétaire ou loueur | documents, inspections, dommages, coûts |
| Affectation | salarié, véhicule, début, fin, source (inspection, manuel) | inspections |
| Inspection | type (départ, retour), réponses, photos, kilométrage, gravité max | affectation, véhicule |
| Dossier dommage | type, gravité, statut, description, lieu, coûts | véhicule, salarié, photos, pièces |
| Avis de contravention | date et heure, lieu, montant, délai, conducteur identifié, statut désignation | véhicule, affectation |
| Document | type, entité liée, dates, fichier, statut de validation | salarié, véhicule ou organisation |
| Absence | salarié, type, dates, statut | salarié |
| Tournée du jour | code, dépôt, date, donneur d'ordre | affectation |
| Coût | nature, montant, date, justificatif | véhicule, dossier |
| Événement d'audit | acteur, action, objet, avant, après, horodatage, origine | tout |

### 9.3 Workflows clés

Prise de véhicule (matin) :
1. Le chauffeur ouvre l'application : son véhicule du jour est affiché (affecté par le dispatcher) ou il scanne un QR code collé dans le véhicule.
2. Inspection de départ : photos obligatoires, kilométrage, checklist.
3. Si un point bloquant est signalé : le véhicule passe en "à vérifier", le manager est notifié, l'affectation est suspendue. Le manager valide (départ autorisé avec commentaire) ou réaffecte un autre véhicule.
4. Sinon : l'affectation démarre, horodatée.

Retour :
1. Inspection de retour (photos, kilométrage, dommages éventuels).
2. Fin de l'affectation.
3. Si un dommage nouveau est signalé : création automatique d'un dossier dommage pré-rempli.

Remplacement :
1. Le dispatcher marque l'absence.
2. Le système propose une liste classée (voir 14.3).
3. Le dispatcher choisit un remplaçant ou envoie une demande à plusieurs candidats (V2).
4. Le véhicule et la tournée sont réaffectés, tout est tracé.

Amende :
1. Photo de l'avis par l'administratif.
2. Le système trouve l'affectation correspondante. S'il y a ambiguïté (deux affectations dans l'heure, véhicule non tracé), il le signale.
3. Un responsable confirme le conducteur.
4. Désignation sur le site officiel (hors logiciel), saisie de la preuve dans le logiciel.
5. Clôture.

### 9.4 Multi-sociétés, multi-dépôts

- Organisation = tenant = frontière de sécurité des données.
- Une organisation peut contenir plusieurs sociétés (SIREN différents) si elles appartiennent au même groupe, et chaque société plusieurs dépôts.
- Les rôles sont attribués par périmètre (organisation, société ou dépôt).
- Un salarié appartient à une société (son employeur). Le prêt d'un chauffeur entre sociétés du groupe est un sujet juridique (prêt de main-d'œuvre, art. L8241-1 et suivants du code du travail, à valider avec un avocat) : le logiciel peut l'enregistrer mais ne doit pas le rendre banal.
- Un groupe voit des indicateurs consolidés. Les données personnelles détaillées restent visibles seulement aux rôles de la société employeur, sauf décision explicite.

---

## 10. Architecture technique

### 10.1 Exigences qui guident les choix

| Exigence | Conséquence |
|---|---|
| Petite équipe (2 à 3 développeurs) | Un seul langage de bout en bout si possible, services managés, pas de micro-services. |
| Application mobile utilisée dans des parkings, stations, sous-sols | Fonctionnement hors ligne pour l'inspection et la déclaration, envoi différé des photos. |
| Beaucoup de photos | Stockage objet, compression côté téléphone, envoi direct vers le stockage par URL signée. |
| Données personnelles de salariés | Hébergement dans l'UE, chiffrement, cloisonnement strict par tenant, journal d'audit. |
| Clients multi-sociétés | Modèle de données avec hiérarchie organisation, société, dépôt. |
| Rapports et alertes quotidiens | Tâches planifiées fiables, file de tâches. |

### 10.2 Comparaison de trois stacks

| Critère | A. TypeScript de bout en bout | B. Laravel (PHP) + Flutter | C. Backend-as-a-service (Supabase ou Firebase) + React Native |
|---|---|---|---|
| Web | Next.js (React) | Laravel + Inertia ou Livewire | Next.js |
| Mobile | React Native (Expo) | Flutter | React Native (Expo) |
| Backend | Node.js (NestJS ou Fastify) | Laravel | Fonctions et règles du BaaS |
| Base | PostgreSQL | PostgreSQL ou MySQL | PostgreSQL (Supabase) ou NoSQL (Firebase) |
| Partage de code web, mobile, backend | Élevé (types, validation, logique métier) | Faible (PHP et Dart) | Moyen |
| Hors ligne mobile | Bon (bibliothèques matures, SQLite local) | Très bon | Bon |
| Vitesse du MVP | Bonne | Très bonne côté back-office | Très bonne au début |
| Dette à 2 ans | Faible si structuré | Faible | Moyenne à forte (logique dispersée dans des règles, dépendance fournisseur) |
| Recrutement en France | Très large | Large | Moyen |
| Multi-tenant strict | PostgreSQL + Row Level Security | Possible (package ou RLS) | Natif sur Supabase (RLS), plus délicat sur Firebase |

Recommandation : stack A.
- Un seul langage pour 2 ou 3 développeurs, types partagés entre le web, le mobile et l'API, ce qui réduit une classe entière de bugs.
- PostgreSQL avec Row Level Security fournit une deuxième barrière de cloisonnement entre clients, en plus du filtrage applicatif.
- React Native avec Expo permet de publier sur iOS et Android avec une seule base de code et des mises à jour rapides.
- La stack B est un choix tout aussi sérieux si l'équipe maîtrise déjà Laravel. Le critère décisif est la compétence de l'équipe réelle, pas la mode. La stack C est tentante pour un prototype, mais je la déconseille pour le produit : la logique métier (affectations, désignation, règles d'alerte) finirait éclatée entre des règles de base de données et des fonctions.

### 10.3 Architecture recommandée

```
 [App chauffeur React Native]      [Back-office web Next.js]
        |   (HTTPS, JWT)                   |
        +---------------+------------------+
                        |
                 [API Node.js modulaire]
                 (monolithe modulaire, un module par domaine)
                        |
     +---------+--------+---------+--------------+
     |         |                  |              |
 [PostgreSQL] [Stockage objet]  [File de tâches] [Services externes]
  RLS/tenant   photos, docs      alertes, imports  e-mail, push, SMS,
  audit log    (URL signées)     rapports, OCR     Mobilic, cartes carburant
```

| Couche | Choix proposé | Justification |
|---|---|---|
| Frontend web | Next.js, React, bibliothèque de composants accessible, tableaux avec tri et filtres | Écosystème large. |
| Mobile | React Native avec Expo, stockage local SQLite, file d'envoi hors ligne | Inspection possible sans réseau. |
| Backend | Monolithe modulaire Node.js (NestJS ou Fastify), validation des entrées par schéma partagé | Simple à déployer, découpable plus tard si nécessaire. |
| API | REST documentée OpenAPI pour le web et le mobile, webhooks sortants en V3 | REST suffit, GraphQL n'apporte rien de décisif ici. |
| Base de données | PostgreSQL managé, une base partagée, colonne tenant_id sur chaque table, Row Level Security | Bon compromis coût et isolation pour des centaines de clients. |
| Authentification | Managers : e-mail et mot de passe, double facteur obligatoire pour les administrateurs. Chauffeurs : lien magique ou code à usage unique, puis code PIN sur l'appareil. Fournisseur d'identité managé ou bibliothèque éprouvée. | Les chauffeurs changent souvent, n'ont pas toujours d'e-mail fiable. Le SMS coûte, à réserver à la première connexion. |
| Stockage photos et documents | Stockage objet compatible S3 hébergé dans l'UE, chiffrement au repos, URL signées à durée courte, compression à l'envoi | Coût bas, pas de fichiers dans la base. |
| Notifications | Push (Expo, FCM, APNs), e-mail transactionnel (fournisseur UE ou avec clauses UE), SMS en option | Voir section 14.4. |
| Tâches planifiées | File de tâches sur PostgreSQL ou Redis | Alertes quotidiennes, imports, rapports. |
| Hébergement | Hébergeur UE : Scaleway, OVHcloud, Clever Cloud, ou AWS/GCP en région Paris | Argument commercial et conformité (transferts hors UE à éviter). Un hébergeur français facilite la vente. |
| Sécurité | Chiffrement TLS, secrets managés, principe du moindre privilège, dépendances surveillées, tests d'intrusion avant commercialisation large | Section 17. |
| Sauvegardes | Sauvegardes automatiques quotidiennes de la base avec restauration à un instant donné, rétention 30 jours, copie dans une autre région UE, versioning du stockage objet, test de restauration trimestriel | Une sauvegarde non testée n'existe pas. |
| Monitoring | Suivi des erreurs (web et mobile), métriques et alertes de disponibilité, page de statut | Détecter avant le client. |
| Logs | Logs applicatifs structurés, sans données personnelles en clair, rétention limitée. Distincts du journal d'audit métier. | Le journal d'audit est une fonctionnalité, les logs sont de l'exploitation. |

### 10.4 Multi-tenant

- Une base partagée, tenant_id obligatoire, Row Level Security activée sur toutes les tables métier, variable de session positionnée par l'API à chaque requête.
- Tests automatisés qui vérifient qu'un utilisateur d'un tenant ne lit jamais les données d'un autre (tests de non-régression dédiés).
- Chemins de stockage objet préfixés par tenant, URL signées générées après contrôle d'accès.
- Possibilité de base dédiée pour un gros client (V3), si un groupe l'exige contractuellement.

### 10.5 Journal d'audit

Table en ajout seul (pas de mise à jour ni de suppression par l'application), une ligne par événement : tenant, acteur (utilisateur ou système), action, type et identifiant de l'objet, valeurs avant et après pour les champs modifiés, horodatage serveur, horodatage appareil si hors ligne, origine (web, mobile, import, API). Rendu lisible dans l'interface sous forme de phrases, par exemple : "Le véhicule AB-123-CD a été affecté à Jean Dupont le 12/09/2026 à 07 h 32 (inspection de départ, application mobile)". Rétention : alignée sur la durée de conservation de l'objet concerné (section 18), et non illimitée.

---

## 11. UX/UI

### 11.1 Principes

1. Un écran = une question. "Qui manque ce matin ?", "Quels véhicules posent problème ?", "Qu'est-ce qui expire ?".
2. Les exceptions d'abord. Le tableau de bord montre ce qui demande une action, pas tout ce qui va bien.
3. Trois clics maximum pour les actions fréquentes (affecter, marquer absent, ouvrir un dossier).
4. Tableaux denses sur ordinateur (les managers traitent des listes), grandes cibles tactiles sur mobile.
5. Couleurs de statut cohérentes partout, toujours doublées d'un texte ou d'une icône (accessibilité).
6. Aucune donnée saisie deux fois : un kilométrage saisi à l'inspection alimente la flotte, le carburant et les alertes.

### 11.2 Navigation back-office

Menu latéral :

1. Aujourd'hui (écran d'accueil de l'exploitation)
2. Planning
3. Véhicules
4. Personnel
5. Dommages
6. Amendes
7. Documents
8. Coûts (V2)
9. Rapports
10. Paramètres

En haut : sélecteur de société et de dépôt, recherche globale (immatriculation, nom), cloche des notifications, profil. Les éléments du menu dépendent du rôle : un dispatcher ne voit pas "Coûts".

### 11.3 Écrans principaux

| Écran | Contenu | Actions principales |
|---|---|---|
| Aujourd'hui | Bandeau de compteurs (tournées à couvrir, chauffeurs présents, absents, véhicules prêts, véhicules bloqués). Liste "à traiter" : absences non remplacées, inspections bloquantes, véhicules non affectés. | Marquer absent, remplacer, débloquer un véhicule. |
| Planning | Grille chauffeurs × jours avec statut (travail, repos, congé, absence), vue jour avec affectations. | Glisser-déposer, dupliquer une semaine, importer les tournées. |
| Fiche véhicule | En-tête (immatriculation, statut, chauffeur actuel, kilométrage). Onglets : historique, inspections, dommages, documents, coûts. | Bloquer, affecter, ajouter un document, ouvrir un dossier. |
| Fiche salarié | En-tête (nom, statut, permis valide ou non). Onglets : documents, absences, véhicules, incidents. | Ajouter une absence, demander un document. |
| Dommages | Tableau kanban ou liste par statut, filtres par gravité et véhicule. | Changer de statut, ajouter devis ou facture. |
| Amendes | Liste triée par délai restant, code couleur. | Confirmer le conducteur, joindre la preuve. |
| Documents | Onglets "expirés", "sous 30 jours", "manquants". | Relancer, téléverser. |

### 11.4 Formulaires

- Valeurs par défaut intelligentes (date du jour, dépôt courant, véhicule actuellement affecté).
- Validation en direct avec message en français clair ("Le kilométrage saisi (125 400) est inférieur au dernier relevé (126 120). Vérifiez ou confirmez la correction.").
- Enregistrement automatique des brouillons.

---

## 12. Application mobile chauffeur

### 12.1 Écran d'accueil

Objectif : moins de 2 minutes par jour hors inspection, inspection en moins de 3 minutes. ESTIMATION / HYPOTHÈSE à mesurer en test.

L'accueil est contextuel, il change selon le moment de la journée :

```
+---------------------------------+
| Bonjour Samir        mar. 29/09 |
|                                 |
|  Aujourd'hui : tournée B12      |
|  Véhicule : AB-123-CD           |
|  [ Prendre le véhicule ]        |   <- bouton principal, gros
|                                 |
|  [ Signaler un problème ]       |
|                                 |
|  Mes documents (1 à renouveler) |
|  Messages (2)                   |
|  Appeler le dispatch            |
+---------------------------------+
```

Après la prise du véhicule, le bouton principal devient "Rendre le véhicule", et "Carburant" apparaît.

Je regroupe "signaler un problème", "signaler un accident" et "signaler un dommage" de la liste initiale en un seul bouton "Signaler un problème", suivi du choix du type. Trois boutons pour des choses que le chauffeur confond sous le stress ne servent à rien. L'accident reste accessible en premier dans la liste des types, avec les consignes de sécurité affichées d'abord.

### 12.2 Fonctions et priorités

| Fonction | MVP | Commentaire |
|---|---|---|
| Ma tournée et mon véhicule du jour | Oui | Lecture seule. |
| Prendre et rendre le véhicule (avec inspection) | Oui | Cœur. |
| Signaler un problème (dommage, accident, panne, autre) | Oui | Hors ligne possible. |
| Carburant | V2 | Sauf si le client n'a pas de carte carburant. |
| Mes documents | Oui (consultation et envoi) | |
| Notifications | Oui | Push. |
| Contacter le manager | Oui (appel direct, numéro du dispatch) | Une messagerie complète est un piège (WhatsApp est déjà là). V2 : consignes avec accusé de lecture. |
| Demande d'absence ou de congé | V2 | |
| Check-in et check-out de présence | Via Mobilic, pas en doublon | Voir 12.3. |

### 12.3 Check-in, check-out et temps de travail

La demande initiale prévoit un check-in et un check-out. En France, pour les conducteurs de VUL de transport pour compte d'autrui, le temps de travail doit être enregistré dans un LIC ou dans Mobilic [S17]. Construire un pointage maison sans lien avec Mobilic créerait :
- une double saisie pour le chauffeur ;
- deux sources de vérité divergentes, ce qui peut se retourner contre l'employeur en cas de litige ou de contrôle.

Proposition :
- MVP : la prise et la restitution du véhicule sont des événements "véhicule", pas du temps de travail. Le logiciel affiche un rappel pour saisir le temps dans Mobilic.
- V2 : intégration de l'API Mobilic [S17] pour lire les temps enregistrés (vue manager consolidée, préparation de la paie) et, si les conditions d'utilisation de l'API le permettent, permettre la saisie depuis l'application. À VALIDER avec l'équipe Mobilic (conditions, périmètre de l'API, procédure d'inscription des éditeurs).

### 12.4 Contraintes techniques mobiles

- Appareil : souvent le téléphone personnel du chauffeur (À VALIDER), parfois un téléphone professionnel fourni. Si c'est le téléphone personnel, l'application ne doit rien collecter en dehors de son usage actif (pas de géolocalisation en arrière-plan), et l'employeur doit en tenir compte dans son information RGPD.
- Hors ligne : inspection et déclaration enregistrées localement, envoi automatique au retour du réseau, indicateur clair "en attente d'envoi".
- Photos : prises dans l'application uniquement (pas depuis la galerie pour l'inspection, afin de garantir la date), compressées, horodatées par l'appareil et le serveur.
- Langues : français au MVP, puis d'autres langues selon la population de chauffeurs (À VALIDER). Amazon traduit déjà les consignes de livraison dans plus de 30 langues [S1], ce qui suggère une population multilingue.

---

## 13. Dashboard

### 13.1 Dashboard dirigeant

Règle : pas plus de 8 à 10 indicateurs sur la première vue, chacun cliquable vers la liste détaillée. Période par défaut : aujourd'hui pour l'opérationnel, mois en cours pour les coûts.

| Bloc | Indicateur | Source | MVP | Commentaire |
|---|---|---|---|---|
| Aujourd'hui | Tournées couvertes / à couvrir | Planning | Oui | |
| Aujourd'hui | Chauffeurs présents, absents, en congé | Planning | Oui | |
| Flotte | Véhicules disponibles, bloqués, immobilisés, en entretien | Flotte | Oui | |
| Risques | Documents expirés ou expirant sous 30 jours | Documents | Oui | |
| Risques | Amendes en attente de désignation, délai le plus court | Amendes | Oui | Indicateur à fort impact financier. |
| Risques | Dossiers dommages ouverts, coût estimé | Dommages | Oui (nombre), V2 (coût) | |
| Flotte | Kilomètres parcourus (mois) | Inspections | V2 | |
| Coûts | Coût carburant, coût entretien et réparation, coût total par véhicule, coût par km | Coûts | V2 | Fiable seulement si les coûts sont saisis ou importés. |
| Personnel | Taux d'absentéisme, entrées et sorties du mois, turnover | Personnel | V2 | |
| Personnel | Heures travaillées | Mobilic | V2 | Dépend de l'intégration. |
| Opérations | Incidents et accidents par 10 000 km | Dommages | V2 | Normaliser par kilométrage, sinon l'indicateur ne veut rien dire. |
| Finance | Coût par tournée | Coûts et tournées | V3 | Seulement si coûts complets et tournées importées. |

Indicateurs volontairement absents : performance de livraison Amazon (scorecard), classement nominatif des chauffeurs sur la page d'accueil. Le premier est dans les outils Amazon, le second pose des problèmes de climat social et de proportionnalité.

### 13.2 Dashboards par rôle

- Fleet manager : véhicules par statut, échéances à 30 jours, dommages par statut, anomalies carburant (V2).
- Exploitation : écran "Aujourd'hui".
- RH : documents manquants, absences de la semaine, entrées et sorties, export paie.
- Comptabilité : coûts du mois par nature et par véhicule, justificatifs manquants.

---

## 14. Automatisations

### 14.1 Liste des automatisations

| Automatisation | Déclencheur | Action | MVP | Valeur |
|---|---|---|---|---|
| Échéances de documents (permis, assurance, carte grise, contrat) | Tâche quotidienne | Alertes à J-90, J-30, J-15, J-7, J0, puis rappel hebdomadaire | Oui | Évite le risque pénal et assurantiel. |
| Contrôle technique | Date de première immatriculation et dernier contrôle | Calcul de l'échéance (4 ans puis tous les 2 ans pour un VUL [S22]) et alerte | Oui | Calcul simple, oubli fréquent (À VALIDER). |
| Entretien | Kilométrage ou date | Alerte avant échéance | V2 | |
| Amendes | Saisie d'un avis | Identification du conducteur, alertes à J+30, J+40, J+44 | Oui | 675 € évités par avis [S19]. |
| Véhicule bloqué | Inspection avec point bloquant | Blocage de l'affectation, notification manager | Oui | Sécurité. |
| Dommage déclaré | Déclaration mobile | Notification immédiate, création du dossier | Oui | |
| Absence | Absence saisie ou chauffeur non présent à l'heure | Alerte dispatcher, liste de remplaçants | Oui | |
| Documents manquants à l'embauche | Création d'un salarié | Liste des pièces à fournir, relances au salarié | V2 | |
| Anomalie de kilométrage | Kilométrage inférieur au précédent, saut incohérent | Demande de confirmation, alerte | Oui | Qualité des données. |
| Anomalie de consommation | Import carburant | Alerte (voir 14.2) | V2 | |
| Véhicule immobilisé longtemps | Immobilisation supérieure à N jours | Alerte au dirigeant | V2 | Coût d'un véhicule loué qui ne roule pas. |
| Accident du travail | Déclaration "accident" avec blessé | Rappel du délai de 48 h pour la DAT [S21] | V2 | |
| Rapport hebdomadaire | Lundi matin | E-mail au dirigeant : incidents, échéances, coûts | V2 | |
| Rapport mensuel | Début de mois | PDF : coûts, sinistralité, conformité | V2 | |
| Export variables de paie | Fin de mois | Fichier au format attendu (Silae ou autre) [S23] | V2 | |

### 14.2 Détection des anomalies de consommation

Méthode sans IA, explicable, suffisante pour la V2 :
1. Pour chaque véhicule, consommation calculée entre deux pleins complets : litres du second plein / km parcourus entre les deux × 100.
2. Référence : médiane glissante des 8 derniers intervalles du véhicule, et médiane des véhicules du même modèle.
3. Alerte si la valeur dépasse la référence de plus de 30 % (seuil paramétrable) sur au moins deux intervalles consécutifs, ou si un plein dépasse la capacité du réservoir, ou si deux pleins sont trop proches en kilométrage.
4. Message lisible : "Le véhicule AB-123-CD consomme 14,1 L/100 km sur les deux derniers pleins, contre 8,2 L/100 km habituellement (+72 %). Causes possibles : fuite, pneus sous-gonflés, erreur de saisie, usage anormal de la carte."

Limites à dire clairement au client : sans kilométrage fiable, le calcul est faux. Les pleins partiels faussent l'intervalle. Les variations de tournées (autoroute contre ville) créent des écarts normaux. Le seuil de 30 % est une ESTIMATION / HYPOTHÈSE à calibrer sur les données réelles des pilotes.

### 14.3 Aide au remplacement

Filtres éliminatoires : salarié actif, pas en congé ni absent ce jour, permis valide et catégorie requise, formations requises pour la tournée (par exemple véhicule électrique), temps de repos respecté (V2 avec Mobilic).

Classement des candidats restants :
1. Pas encore affecté ce jour (disponible) avant déjà affecté (il faudrait décaler une autre tournée).
2. Connaît la tournée ou la zone (historique).
3. Moins d'heures sur la semaine (équité, respect des durées).
4. A déclaré sa disponibilité (V2).

Le système propose, l'humain décide. Pas d'affectation automatique au MVP : une mauvaise affectation automatique détruirait la confiance.

### 14.4 Notifications

| Événement | Destinataires | Canal | Urgence | Exemple de message |
|---|---|---|---|---|
| Dommage ou accident déclaré | Fleet manager, exploitation | Push + e-mail | Immédiate | "Samir B. a déclaré un dommage sur AB-123-CD (rétroviseur, 3 photos) à 10 h 42." |
| Inspection avec point bloquant | Exploitation, fleet manager | Push | Immédiate | "Inspection de départ AB-123-CD : freins signalés défectueux. Véhicule bloqué en attente de validation." |
| Absence ou retard | Exploitation | Push | Immédiate | "Karim L. est absent aujourd'hui (tournée B12 à couvrir). 4 remplaçants possibles." |
| Document expirant | Responsable concerné, salarié si document personnel | E-mail groupé quotidien, push au salarié | J-30, J-15, J-7 | "Le permis de Jean Dupont expire dans 30 jours (le 29/10/2026)." |
| Contrôle technique | Fleet manager | E-mail groupé | J-60, J-30, J-15 | "Le contrôle technique du véhicule AB-123-CD expire dans 15 jours." |
| Amende à désigner | Administratif, dirigeant | E-mail + interne | J+30, J+40, J+44 | "Avis de contravention AB-123-CD du 12/09 : 5 jours restants pour désigner le conducteur." |
| Consommation anormale | Fleet manager | Interne + e-mail groupé | Hebdomadaire | "Le véhicule AB-123-CD a une consommation anormalement élevée (+72 %)." |
| Véhicule immobilisé longtemps | Dirigeant | E-mail | Après N jours | "AB-123-CD est immobilisé depuis 12 jours (dossier dommage n° 48)." |
| Document demandé au chauffeur | Chauffeur | Push | Normale | "Merci d'envoyer la photo de votre nouveau permis." |

Règles anti-bruit : regroupement quotidien de tout ce qui n'est pas urgent, préférences par utilisateur, pas de notification la nuit sauf accident. Le SMS se réserve à la première connexion du chauffeur et aux alertes critiques si le push échoue. Coût par SMS en France de l'ordre de quelques centimes selon le fournisseur (À VALIDER sur devis).

---

## 15. IA

Règle appliquée : une fonction IA n'entre dans le produit que si elle fait gagner du temps ou de l'argent mesurable, et si une règle simple ne fait pas aussi bien.

| Fonction IA | Valeur économique | Alternative sans IA | Verdict |
|---|---|---|---|
| Lecture automatique des avis de contravention (date, heure, lieu, immatriculation, montant) | Quelques minutes par avis, erreurs de saisie évitées sur un processus à fort enjeu | Saisie manuelle (1 à 2 min) | V2. Utile si le volume d'avis est élevé (À VALIDER en entretien). Validation humaine obligatoire. |
| Lecture des dates d'expiration sur les documents (permis, assurance) | Gain à l'onboarding de chaque salarié, fort si turnover élevé | Saisie manuelle | V2 ou V3, avec validation humaine. |
| Rapprochement tickets et relevés de carte | Faible si relevés de carte importés | Import CSV | À ne pas faire. |
| Résumé d'un dossier dommage pour l'assureur ou le dirigeant | Quelques minutes par dossier | Modèle de document pré-rempli | V3, seulement si les clients le demandent. |
| Détection de dommages sur les photos (comparaison départ et retour) | Potentiellement forte (dommages imputés, preuve loueur) | Revue humaine des photos | V3 au plus tôt. Difficile : angles, lumière, saleté, faux positifs. Des entreprises spécialisées existent, mieux vaut s'intégrer que développer. |
| Prédiction de maintenance | Faible pour des VUL loués avec entretien inclus | Plan d'entretien par km et date | À ne pas faire. Il faut beaucoup de données de pannes pour un modèle fiable. |
| Assistant conversationnel "fleet manager" | Incertaine. Amazon lance déjà un assistant pour la performance [S1]. | Bons filtres et rapports | V3, seulement pour des questions sur les données du client ("combien a coûté AB-123-CD cette année ?"), avec citations des données. |
| Analyse des coûts et rapport mensuel commenté | Moyenne : le dirigeant lit un texte plutôt qu'un tableau | Rapport à règles ("coût carburant +18 % par rapport au mois précédent") | V2 avec règles, texte généré en V3 si demandé. |
| Détection d'anomalies de consommation | Réelle | Règles statistiques (14.2) | Règles, pas d'IA. |

Précautions : toute sortie d'IA qui touche un salarié (imputation d'un dommage, désignation pour une amende) doit être validée par un humain. Si un fournisseur de modèle externe traite des données personnelles, il faut un contrat de sous-traitance RGPD, un hébergement ou des garanties UE, et une mention dans le registre des traitements. Le règlement européen sur l'IA classe certains systèmes utilisés dans l'emploi et la gestion des travailleurs comme à haut risque ; il faut vérifier si une fonction d'évaluation ou d'affectation automatisée tombe dans ce champ avant de la développer (À VALIDER juridiquement).

---

## 16. Intégrations

| Intégration | Intérêt | Données échangées | API disponible | Difficulté | Coût | Contraintes | Priorité |
|---|---|---|---|---|---|---|---|
| Amazon (Cortex, scorecard, portail DSP) | Éviter de ressaisir les tournées du jour | Liste des tournées, affectations | Aucune API publique identifiée pour les DSP | Élevée | Nul (import) | Pas de scraping, respect des conditions Amazon. Import de fichiers exportés par le client lui-même si Amazon le permet (À VALIDER avec des DSP et, idéalement, avec Amazon). | MVP en import CSV/Excel générique |
| Autres donneurs d'ordre (Chronopost, DPD, GLS) | Même besoin | Tournées | Inconnue | Variable | Nul (import) | Idem | V2 |
| Mobilic | Temps de travail conforme sans double saisie | Temps de travail, activités | Oui, API publique documentée, accès après inscription validée [S17] | Moyenne | Gratuit (à confirmer) | Autorisation de chaque entreprise cliente via un identifiant client [S17] | V2 (prise de contact dès la Phase 1) |
| Cartes carburant (TotalEnergies, DKV, Shell, AS24) | Coûts et consommation sans saisie | Transactions, litres, montant, station, parfois kilométrage | Relevés et portails pour tous. API à confirmer au cas par cas. Des éditeurs français s'y connectent déjà [S24]. | Moyenne | Possible frais ou partenariat | Accord de l'émetteur et du client | V2 (import CSV d'abord) |
| Télématique constructeur (Stellantis Pro One via Mobilisights, Renault, Ford Pro, Mercedes) ou agrégateurs (High Mobility, Smartcar) | Kilométrage automatique, alertes techniques, niveau de carburant ou de charge | Kilométrage, alertes, parfois position | Oui, payant [S25] | Moyenne | Par véhicule et par mois, sur devis | Position = données de géolocalisation (CNIL). Ne récupérer que le kilométrage et les alertes au départ. | V3 |
| Boîtiers télématiques tiers (Geotab, etc.) | Clients déjà équipés | Kilométrage, trajets | Oui chez la plupart | Moyenne | Variable | Idem CNIL | V3 à la demande |
| Mentor, Netradyne | Données de conduite | Scores de conduite | Non identifiée pour des tiers | Élevée | Inconnu | Données de surveillance, sensibles | À ne pas faire |
| Paie (Silae, PayFit, autres) | Variables de paie sans ressaisie | Absences, heures, primes | Silae : API pour éditeurs et import de fichiers [S23]. PayFit : API à vérifier. | Moyenne | Variable | Le plus souvent, la paie est faite par un expert-comptable : l'export doit lui convenir. | V2 (export fichier), V3 (API) |
| Comptabilité (Pennylane, Sage, Cegid, export expert-comptable) | Coûts et justificatifs | Écritures, pièces | Oui pour la plupart | Moyenne | Variable | Plan comptable du client | V3 |
| Stockage documentaire (Google Drive, OneDrive) | Clients qui veulent une copie | Fichiers | Oui | Faible | Nul | Risque de fuite hors du cloisonnement | À ne pas faire au début |
| E-mail transactionnel | Alertes, rapports | Messages | Oui | Faible | Quelques dizaines d'euros par mois au début (À VALIDER sur devis) | Fournisseur avec garanties UE | MVP |
| SMS | Première connexion, alertes critiques | Messages | Oui | Faible | Au message | Coût à refacturer au-delà d'un quota | MVP (limité) |
| Cartes et géocodage | Adresses des dépôts, lieu d'un accident | Adresses, coordonnées | Oui (Base Adresse Nationale gratuite pour la France, fournisseurs commerciaux) | Faible | Faible | | MVP (localisation ponctuelle seulement) |
| ANTAI (désignation) | Désignation plus rapide | Identité du conducteur | Désignation en ligne par formulaire. API publique pour éditeurs non identifiée. | Élevée si automatisée | Nul | Ne pas automatiser sans cadre officiel | MVP : aide à la saisie manuelle |
| Vérification du permis (téléservice) | Preuve de validité | Validité oui ou non | Pas d'API publique identifiée [S20] | | Participation financière demandée aux employeurs [S20] | Personne habilitée désignée par l'entreprise | V2 : rappel et traçabilité |

---

## 17. Sécurité

### 17.1 Ce qu'il faut protéger

Données personnelles de salariés (identité, permis, adresse, documents, absences, incidents), photos, documents de l'entreprise, données financières. Menaces principales : fuite entre clients (erreur de cloisonnement), compte manager compromis (hameçonnage), téléphone chauffeur perdu, employé malveillant ou ancien employé qui garde un accès, rançongiciel chez l'hébergeur ou le client.

### 17.2 Mesures

| Mesure | Niveau |
|---|---|
| Cloisonnement par tenant à deux niveaux (application et Row Level Security) avec tests automatisés | MVP |
| Chiffrement en transit (TLS) et au repos (base, stockage objet, sauvegardes) | MVP |
| Double facteur obligatoire pour les administrateurs, proposé aux managers | MVP |
| Sessions courtes sur le web, révocation des accès à la sortie d'un salarié (automatique quand son statut passe à "sorti") | MVP |
| Application mobile : jeton stocké dans le stockage sécurisé du téléphone, code PIN, effacement des données locales à la déconnexion | MVP |
| URL signées à durée courte pour tous les fichiers, aucun fichier public | MVP |
| Journal d'audit des accès aux données sensibles (consultation d'un dossier salarié) | V2 |
| Gestion des secrets hors du code, rotation | MVP |
| Analyse automatique des dépendances et du code | MVP |
| Test d'intrusion par un prestataire externe | Avant la commercialisation large (Phase 6) |
| Plan de réponse à incident, notification des violations de données | MVP (procédure écrite) |
| Référentiels : les recommandations de l'ANSSI pour une petite structure, puis ISO 27001 si des grands comptes l'exigent | V3 |

---

## 18. RGPD

Distinction demandée : obligatoire, recommandé, dépend du contexte. Les références renvoient aux textes ou à la CNIL ; leur application précise doit être validée par un DPO ou un avocat.

### 18.1 Qui est responsable de quoi

- Le client (le DSP) est responsable de traitement pour les données de ses salariés et de sa flotte.
- L'éditeur du logiciel est sous-traitant au sens du RGPD (art. 28) : il traite les données pour le compte du client. Il faut un contrat de sous-traitance (DPA) avec chaque client, qui liste les sous-traitants ultérieurs (hébergeur, e-mail, SMS, IA).
- L'éditeur est lui-même responsable de traitement pour ses propres données (comptes clients, facturation, prospection).

### 18.2 Tableau des obligations

| Sujet | Juridiquement obligatoire | Recommandé | Dépend du contexte |
|---|---|---|---|
| Base légale | Chaque traitement a une base légale (RGPD art. 6). Pour la gestion du personnel : exécution du contrat de travail, obligations légales, intérêt légitime. Le consentement du salarié est rarement une base valable dans la relation de travail. | Documenter la base par traitement dans le logiciel (modèle fourni au client). | |
| Information des salariés | Informer les personnes (RGPD art. 13). Informer et consulter le CSE avant la mise en place d'un moyen de contrôle de l'activité des salariés (code du travail, art. L2312-38, à confirmer par un avocat). | Fournir au client un modèle de note d'information. La CNIL publie un exemple pour la géolocalisation [S15]. | Existence d'un CSE (seuil de 11 salariés). |
| Minimisation | Ne collecter que le nécessaire (RGPD art. 5). | Pas de champ libre "santé", pas de motif médical d'absence, pas de numéro de sécurité sociale si non nécessaire. | |
| Durées de conservation | Durées limitées et définies (RGPD art. 5). | Suivre le référentiel CNIL RH (avril 2026) : données RH en base active pendant la présence du salarié, puis archivage intermédiaire, avec 5 ans après le départ comme repère pour plusieurs catégories [S16]. Purge automatique paramétrée par type de donnée. | Contentieux en cours (conservation jusqu'à la fin du litige). |
| Géolocalisation | Pas de contrôle des limitations de vitesse par ce moyen. Pas de géolocalisation en dehors du temps de travail, possibilité de désactivation pendant les pauses et trajets personnels. Durée de conservation de 2 mois, 1 an si nécessaire à la preuve des prestations, 5 ans si utilisée pour le suivi du temps de travail [S14][S15]. | Ne pas géolocaliser en continu dans le produit. Enregistrer seulement la position ponctuelle d'une déclaration d'incident, à la demande du chauffeur. | Si le client active une télématique : AIPD probablement nécessaire [S15]. |
| Analyse d'impact (AIPD) | Obligatoire pour les traitements à risque élevé (RGPD art. 35), notamment la surveillance systématique des salariés selon la liste de la CNIL (À VALIDER sur la liste en vigueur). | L'éditeur fournit une AIPD type que le client adapte. | Géolocalisation continue, notation des chauffeurs, IA d'évaluation. |
| Photos | Données personnelles si une personne est identifiable (visage, plaque d'un tiers). | Consigne dans l'application : photographier le véhicule, pas les personnes. Floutage des visages en V3 si besoin. | Photos de tiers lors d'un accident : conservation limitée au dossier. |
| Vidéo (dashcam) | Si installée : information, proportionnalité, pas de surveillance permanente du salarié (règles CNIL vidéosurveillance, à vérifier). | Ne pas intégrer la vidéo au produit. | |
| Permis de conduire, infractions | Les données relatives aux infractions sont encadrées (RGPD art. 10, loi Informatique et libertés). L'employeur peut recevoir l'information de validité du permis via le téléservice dans le cadre prévu par le code de la route [S20]. | Stocker uniquement ce qui sert à la désignation et à la validité du permis, pas l'historique des points. | Statut de l'entreprise (transport public routier pour le téléservice). |
| Désignation du conducteur | Obligation légale de désigner (art. L121-6) [S18]. Le traitement est fondé sur une obligation légale. | Accès restreint aux avis. | |
| Sécurité | Mesures appropriées (RGPD art. 32). | Section 17. | |
| Transferts hors UE | Encadrés (RGPD chap. V). | Hébergement et sous-traitants dans l'UE. | Fournisseurs d'IA ou d'e-mail américains. |
| Droits des personnes | Accès, rectification, effacement dans les limites légales. | Export des données d'un salarié en un clic. | |
| Registre des traitements | Obligatoire pour le client et pour l'éditeur en tant que sous-traitant (RGPD art. 30). | Fournir un modèle pré-rempli au client. | |
| Violation de données | Notification à la CNIL sous 72 h par le responsable de traitement, le sous-traitant prévient le client sans délai (RGPD art. 33). | Procédure écrite, exercice annuel. | |

### 18.3 Notation des chauffeurs : prudence

La demande initiale mentionne les "performances des chauffeurs" et les "évaluations". Une notation interne qui combine incidents, amendes et absences pour classer les salariés est un traitement sensible : risque de discrimination (absences liées à la santé ou à la grossesse, par exemple), de contestation, et possiblement de classement "à haut risque" au sens du règlement européen sur l'IA si elle est automatisée (À VALIDER). Recommandation : pas de score global de chauffeur dans le produit. Des historiques factuels (incidents, dommages) consultables par les personnes habilitées, et c'est tout.

---

## 19. MVP

### 19.1 Objectif du MVP

Prouver, chez 3 à 5 DSP pilotes, trois choses mesurables en 3 mois :
1. Les chauffeurs font l'inspection de départ et de retour dans l'application au moins 80 % des jours travaillés.
2. Le client retrouve le conducteur de chaque avis de contravention reçu pendant le pilote, sans recherche manuelle.
3. Le client accepte de payer à la fin du pilote.

Tout ce qui ne sert pas ces trois preuves attend.

### 19.2 Hypothèses de coût

- Coût d'un jour de développement : 450 à 650 € (freelance ou coût chargé d'un salarié ramené au jour). ESTIMATION / HYPOTHÈSE, à vérifier sur le marché local.
- Les charges sont exprimées en jours-développeur (j), puis converties à 550 €/j pour donner un ordre de grandeur.
- Difficulté : Faible, Moyenne, Élevée.

### 19.3 MVP obligatoire

| Fonction | Valeur client | Difficulté | Charge | Coût estimatif | Dépendances | Priorité |
|---|---|---|---|---|---|---|
| Socle : multi-tenant, sociétés, dépôts, utilisateurs, rôles, audit log | Condition de vente (sécurité, traçabilité) | Moyenne | 25 à 35 j | 14 à 19 k€ | Aucune | P0 |
| Fiche véhicule, statuts, immobilisations | Base de tout | Faible | 10 à 12 j | 6 à 7 k€ | Socle | P0 |
| Fiche salarié, permis, statuts | Base de tout | Faible | 8 à 10 j | 4 à 6 k€ | Socle | P0 |
| Documents et alertes d'expiration (multi-niveaux), contrôle technique calculé | Évite des risques pénaux et assurantiels | Faible à moyenne | 12 à 15 j | 7 à 8 k€ | Véhicules, salariés, notifications | P0 |
| Application mobile : socle (connexion, hors ligne, envoi de photos) | Condition de l'adoption | Élevée | 25 à 35 j | 14 à 19 k€ | Socle | P0 |
| Prise et restitution du véhicule avec inspection, photos, kilométrage, blocage | Cœur : preuve de l'état et du conducteur | Moyenne | 15 à 20 j | 8 à 11 k€ | Mobile, véhicules | P0 |
| Historique des affectations (intervalles) | Cœur : amendes, dommages | Moyenne | 8 à 10 j | 4 à 6 k€ | Inspection | P0 |
| Déclaration de problème et dossier dommage (statuts, pièces, historique) | Coûts de sinistres maîtrisés | Moyenne | 15 à 20 j | 8 à 11 k€ | Mobile, affectations | P0 |
| Amendes : saisie, conducteur identifié, délai de 45 jours, preuve | ROI immédiat (675 € par non-désignation [S19]) | Faible | 8 à 12 j | 4 à 7 k€ | Affectations | P0 |
| Planning du jour : import CSV des tournées, affectations, absences, calendrier | Usage quotidien des managers | Moyenne | 20 à 25 j | 11 à 14 k€ | Salariés, véhicules | P0 |
| Aide au remplacement (liste filtrée et classée) | Gain de temps le matin | Faible | 5 à 7 j | 3 à 4 k€ | Planning, permis | P0 |
| Notifications push et e-mail, préférences | Réactivité | Faible | 8 à 10 j | 4 à 6 k€ | Socle | P0 |
| Écran "Aujourd'hui" et tableau de bord dirigeant (indicateurs MVP) | Visibilité | Faible | 8 à 10 j | 4 à 6 k€ | Tous | P0 |
| Exports CSV | Réversibilité, confiance | Faible | 3 à 5 j | 2 à 3 k€ | Tous | P0 |
| Qualité, tests, déploiement, publication sur les stores, documentation RGPD de base | Fiabilité | Moyenne | 20 à 25 j | 11 à 14 k€ | Tous | P0 |
| Total MVP | | | 190 à 250 j | 105 à 140 k€ | | |

Avec 2 développeurs à plein temps, cela représente 4,5 à 6 mois calendaires en comptant les imprévus. ESTIMATION / HYPOTHÈSE. Si les fondateurs développent eux-mêmes, le coût monétaire baisse mais pas le temps.

### 19.4 V2 (après les pilotes, selon les retours)

| Fonction | Valeur | Difficulté | Charge | Dépendances |
|---|---|---|---|---|
| Intégration Mobilic (lecture des temps, puis saisie si autorisée) | Forte (conformité, paie) | Moyenne | 15 à 25 j | Accord Mobilic |
| Import des relevés de cartes carburant, consommation, anomalies | Moyenne à forte | Moyenne | 15 à 20 j | Données de kilométrage fiables |
| Coûts par véhicule, coût au km, rapport mensuel | Moyenne | Faible | 10 à 15 j | Carburant, dommages |
| Coûts des dossiers dommages, refacturation, lien de partage pour garage ou expert | Moyenne | Faible | 8 à 10 j | Dommages |
| Onboarding mobile des nouveaux salariés, demande de documents | Forte si turnover élevé | Faible | 8 à 12 j | Documents |
| Demandes d'absence et de congé depuis l'application | Moyenne | Faible | 6 à 8 j | Planning |
| Demande de remplacement envoyée aux candidats | Moyenne | Faible | 5 à 8 j | Remplacement |
| Export des variables de paie (format Silae, format générique pour l'expert-comptable) | Forte | Moyenne | 10 à 15 j | Absences, Mobilic |
| Entretien préventif (échéances par km et date) | Moyenne | Faible | 6 à 8 j | Kilométrage |
| Lecture automatique des avis de contravention | Moyenne | Moyenne | 8 à 12 j | Module amendes, volume suffisant |
| Consignes avec accusé de lecture | Moyenne | Faible | 5 à 8 j | Mobile |
| Rôle chef d'équipe, vues groupe multi-sociétés | Moyenne | Moyenne | 8 à 12 j | Socle |
| Checklist accident du travail (délai 48 h) | Moyenne | Faible | 2 à 3 j | Dommages |

### 19.5 V3

Télématique constructeur (kilométrage automatique), intégrations comptables, API publique et webhooks, lecture automatique des documents, assistant de questions sur les données, SSO, base dédiée pour un groupe, multilingue étendu, ouverture à d'autres pays.

### 19.6 À ne pas développer

| Fonction | Raison |
|---|---|
| Tableaux de bord scorecard Amazon | Couvert par Amazon et des concurrents, dépendance aux formats Amazon, risque contractuel. |
| Scraping des portails Amazon | Contraire aux conditions d'utilisation probables, peut coûter son contrat au client. |
| Optimisation de tournées, navigation | Fait par les donneurs d'ordre. |
| GPS temps réel maison, boîtier propriétaire | Coût, contraintes CNIL, matériel. |
| Paie complète | Métier à part, couvert par le marché. |
| Messagerie instantanée complète | Perdue d'avance face à WhatsApp. Consignes ciblées seulement. |
| Score global des chauffeurs | Risques juridiques et sociaux (18.3). |
| Prédiction de maintenance par IA | Pas assez de données, faible valeur pour des véhicules loués. |
| Retenue sur salaire pour dommages | Illégal en tant que sanction pécuniaire (art. L1331-2 code du travail) [S32]. |
| Suivi détaillé des pneus | Valeur faible pour des VUL en location. |

---

## 20. Roadmap

Budgets hors salaires des fondateurs sauf mention contraire. Toutes les durées et tous les budgets sont des ESTIMATIONS / HYPOTHÈSES.

### Phase 1 : validation du problème (6 à 8 semaines)

| | |
|---|---|
| Objectifs | Confirmer ou infirmer H1 à H5 (section 2.3). |
| Activités | 15 à 20 entretiens de dirigeants et managers de DSP (Amazon), 5 entretiens de sous-traitants d'autres donneurs d'ordre, 2 matinées d'observation dans un dépôt, 5 entretiens de chauffeurs. Collecte d'artefacts (fichiers Excel, exemples d'avis de contravention anonymisés, relevés de carte carburant, exports disponibles depuis les outils Amazon). Contact avec l'équipe Mobilic pour l'API. Consultation d'un avocat en droit social et d'un DPO (3 à 5 heures). |
| Fonctionnalités | Aucune. |
| Ressources | Fondateur ou fondatrice à plein temps, idéalement quelqu'un qui connaît l'exploitation d'un DSP. |
| Risques | Difficulté d'accès aux DSP (communauté fermée, dirigeants très occupés). Biais de politesse en entretien. |
| Budget | 3 à 8 k€ (déplacements, avocat, outils). |
| Critères de passage | Au moins 10 dirigeants sur 15 décrivent une perte chiffrée sur amendes, dommages ou documents. Au moins 3 acceptent un pilote avec engagement écrit (lettre d'intention avec prix). Réponse de Mobilic sur l'accès à l'API. Si ces critères ne sont pas atteints, revoir le positionnement avant de dépenser plus. |

Questions à poser en entretien (extrait) : "Combien d'avis de contravention avez-vous reçus le mois dernier ? Combien avez-vous payés sans désigner ?" "Racontez le dernier dommage découvert sur un véhicule : quand, par qui, combien ça a coûté, qui a payé ?" "Qu'est-ce qui se passe à 6 h 45 quand un chauffeur ne vient pas ?" "Quels logiciels payez-vous aujourd'hui et combien ?" "Qu'est-ce qu'Amazon vous fournit déjà comme outil, et qu'est-ce qui manque ?" "Vos chauffeurs utilisent-ils leur téléphone personnel ?" Éviter : "Est-ce que vous aimeriez un logiciel qui... ?"

### Phase 2 : prototype (4 à 6 semaines)

| | |
|---|---|
| Objectifs | Valider les parcours et l'adoption par les chauffeurs avant de coder. |
| Fonctionnalités | Maquettes cliquables : écran "Aujourd'hui", fiche véhicule, amendes, application chauffeur (prise du véhicule, inspection, déclaration). |
| Ressources | Designer UX freelance, fondateur. |
| Risques | Tester en salle plutôt que sur le terrain. |
| Budget | 5 à 15 k€. |
| Critères de passage | 5 chauffeurs réalisent l'inspection maquette en moins de 3 minutes sans aide. Les managers pilotes confirment l'ordre de priorité des fonctions. |

### Phase 3 : MVP (4,5 à 6 mois)

| | |
|---|---|
| Objectifs | Livrer le périmètre 19.3, stable et utilisable chaque jour. |
| Ressources | 2 développeurs (dont au moins un senior avec expérience mobile hors ligne), fondateur produit. |
| Risques | Dérive du périmètre, application mobile instable en conditions réelles (réseau, vieux téléphones). |
| Budget | 105 à 140 k€ si développement externalisé ou salarié, plus 300 à 800 €/mois d'infrastructure et outils. |
| Critères de passage | Utilisé en interne sur un jeu de données réaliste pendant 2 semaines sans bug bloquant, cloisonnement testé, sauvegardes restaurées avec succès. |

### Phase 4 : clients pilotes (3 mois)

| | |
|---|---|
| Objectifs | Les trois preuves du 19.1. |
| Activités | 3 à 5 DSP, installation accompagnée (import des véhicules et salariés, formation des managers, 10 minutes de formation chauffeurs au dépôt). Point hebdomadaire. Mesures d'usage. |
| Tarif | Pilote gratuit le premier mois, puis tarif réduit (par exemple -50 %) avec engagement de passage au tarif normal. |
| Risques | Un pilote abandonne pour une raison externe (perte de station). Adoption chauffeur faible. |
| Budget | Temps de l'équipe, déplacements 2 à 5 k€. |
| Critères de passage | Au moins 3 clients payants. Inspections faites au moins 80 % des jours. Au moins un cas documenté de gain financier (amende désignée à temps, dommage imputé à un tiers ou au loueur avec preuve). |

### Phase 5 : amélioration du produit (3 à 6 mois)

| | |
|---|---|
| Objectifs | V2 prioritaire selon les pilotes, probablement Mobilic, carburant, coûts, onboarding, export paie. |
| Ressources | Même équipe. |
| Risques | Construire pour un seul client très bruyant. |
| Budget | 60 à 100 k€. |
| Critères de passage | 8 à 10 clients payants, churn nul sur les pilotes, cycle de vente reproductible documenté. |

### Phase 6 : commercialisation (6 à 12 mois)

| | |
|---|---|
| Objectifs | Passer de 10 à 40 à 60 clients. |
| Canaux | Bouche-à-oreille entre DSP (communauté resserrée), prescripteurs : experts-comptables spécialisés transport, courtiers en assurance flotte (la sinistralité maîtrisée les intéresse), loueurs de VUL, organisations professionnelles du transport léger. Contenu utile (guide "désignation du conducteur", "Mobilic pour un DSP"). |
| Ressources | Une personne commerciale et accompagnement client, développement continu. |
| Risques | Coût d'acquisition élevé pour de petits comptes. Réaction d'Amazon (outil concurrent, règles). |
| Budget | 80 à 150 k€ (commercial, marketing, test d'intrusion). |
| Critères de passage | 15 à 25 k€ de revenu mensuel récurrent, churn mensuel inférieur à 2 %, au moins 20 % des clients hors Amazon ou multi-donneurs d'ordre. |

### Phase 7 : scale

| | |
|---|---|
| Objectifs | Élargir : sous-traitants de tous les réseaux de colis, transport léger, puis Belgique, Espagne, Italie ou Royaume-Uni selon l'analyse réglementaire. |
| Fonctionnalités | V3 : télématique, API, intégrations comptables, IA justifiée par l'usage. |
| Ressources | Équipe de 6 à 12 personnes. |
| Risques | Chaque pays a son droit du travail et ses règles d'amendes : l'expansion internationale coûte plus cher qu'il n'y paraît. |
| Budget | Levée de fonds ou autofinancement selon la traction. Non chiffrable sérieusement à ce stade. |

---

## 21. Business model

### 21.1 Unités de facturation comparées

| Modèle | Avantages | Inconvénients | Verdict |
|---|---|---|---|
| Par véhicule | Unité stable, comprise, alignée sur la valeur (dommages, amendes, documents). Standard du marché de la flotte (Fleetio [S9], Samsara [S10]). | Pénalise un peu les flottes qui ont beaucoup de véhicules de réserve. | Recommandé. Facturer les véhicules actifs (non sortis de flotte). |
| Par chauffeur actif | Suit l'activité. Choisi par Hera (9 $ par chauffeur actif [S11]). | Turnover élevé : facture variable, contestable, difficile à prévoir. | Alternative crédible. À tester en entretien. |
| Par entreprise (forfait fixe) | Simple. | Sous-facture les gros, trop cher pour les petits. | Seulement comme minimum mensuel. |
| Forfaits par taille de flotte | Lisible. | Effets de seuil. | Possible en présentation (paliers 1 à 25, 26 à 60, plus de 60). |
| Modules premium | Monétise les intégrations coûteuses. | Complexité commerciale. | Deux forfaits maximum au lancement. |

### 21.2 Proposition de grille (à tester)

| Forfait | Contenu | Prix | Statut |
|---|---|---|---|
| Essentiel | Flotte, documents et alertes, application chauffeur, inspections, dommages, amendes, planning et remplacement | 12 € HT par véhicule actif et par mois, minimum 149 € HT par mois | ESTIMATION / HYPOTHÈSE |
| Pro | Essentiel + carburant, coûts, rapports, Mobilic, export paie, onboarding | 18 € HT par véhicule actif et par mois | ESTIMATION / HYPOTHÈSE |
| Groupe | Multi-sociétés, consolidation, SSO, API, accompagnement dédié | Sur devis | ESTIMATION / HYPOTHÈSE |
| SMS | Quota inclus, puis refacturation | Au coût majoré | ESTIMATION / HYPOTHÈSE |

### 21.3 Pourquoi ces prix sont raisonnables (hypothèses explicites)

1. Repères concurrents : Fleetio de 4 à 10 $ par véhicule sans planning ni RH [S9] ; Hera 9 $ par chauffeur actif, orienté performance Amazon [S11] ; logiciels de flotte français de 8 à 28 € par véhicule avec boîtier [S26]. Un prix de 12 à 18 € se situe au-dessus d'un Fleetio d'entrée de gamme et en dessous des offres avec matériel, ce qui correspond à un logiciel plus large sans matériel.
2. Poids dans le chiffre d'affaires du client : un DSP de 30 tournées par jour payées environ 200 € [S4], sur environ 25 jours par mois, réalise de l'ordre de 150 k€ de chiffre d'affaires mensuel (ESTIMATION / HYPOTHÈSE : le nombre de jours travaillés et le prix exact varient). 30 véhicules à 12 € = 360 € par mois, soit environ 0,25 % du chiffre d'affaires.
3. Retour sur investissement : une seule non-désignation évitée par mois (675 € pour une société [S19]) rembourse deux mois d'abonnement d'une flotte de 30 véhicules. Un seul dommage correctement imputé à un tiers ou prouvé face au loueur peut valoir plusieurs centaines d'euros (À VALIDER en entretien).
4. Contrainte : les marges des DSP sont faibles et sous pression [S4]. Le prix doit donc être justifié par un gain chiffré, présenté dès la démonstration commerciale.

Méthode de validation en Phase 1 : questions de type Van Westendorp (à quel prix est-ce trop cher, cher mais acceptable, bon marché, trop bon marché pour être sérieux) posées après la démonstration de la maquette, et surtout lettres d'intention avec un prix écrit. Une intention sans prix ne vaut rien.

### 21.4 Projection simple (ESTIMATION / HYPOTHÈSE)

| Hypothèse | Valeur |
|---|---|
| Flotte moyenne par client | 30 véhicules |
| Revenu moyen par véhicule (mix Essentiel et Pro) | 14 € HT |
| Revenu mensuel par client | 420 € |
| Churn annuel des clients | 15 à 25 % (fragilité des DSP, pertes de stations) |
| Coût d'hébergement et services par client | 10 à 25 € par mois |

| Clients | Revenu mensuel récurrent | Revenu annuel |
|---|---|---|
| 10 | 4,2 k€ | 50 k€ |
| 40 | 16,8 k€ | 200 k€ |
| 100 | 42 k€ | 500 k€ |
| 250 (nécessite d'être sorti du seul segment Amazon France) | 105 k€ | 1,26 M€ |

Lecture : 100 clients représentent déjà une part très importante des DSP Amazon en France (section 5.1). Au-delà, la croissance ne viendra que de l'élargissement aux autres sous-traitants et à d'autres pays.

---

## 22. Estimation des coûts

Toutes les valeurs sont des ESTIMATIONS / HYPOTHÈSES.

### 22.1 Coûts de construction

| Poste | Phase 1 à 4 (environ 10 à 12 mois) | Phase 5 et 6 (12 mois suivants) |
|---|---|---|
| Développement | 105 à 140 k€ | 120 à 200 k€ |
| Design UX | 5 à 15 k€ | 5 à 10 k€ |
| Juridique (avocat social, DPO, CGV, DPA) | 3 à 8 k€ | 3 à 5 k€ |
| Test d'intrusion | | 5 à 10 k€ |
| Commercial et marketing | | 60 à 120 k€ |
| Infrastructure et outils | 4 à 10 k€ | 8 à 20 k€ |
| Déplacements et divers | 3 à 8 k€ | 5 à 10 k€ |
| Total | 120 à 180 k€ | 200 à 375 k€ |

### 22.2 Coûts d'exploitation mensuels au lancement

| Poste | Estimation |
|---|---|
| Hébergement applicatif et base managée (UE) | 150 à 400 € |
| Stockage objet (photos) | 20 à 100 €, croît avec le nombre d'inspections |
| E-mail transactionnel | 0 à 50 € |
| SMS | Variable, refacturé |
| Suivi des erreurs, monitoring | 0 à 100 € |
| Comptes développeur Apple et Google | Environ 10 € par mois lissé |
| Total | Environ 300 à 800 € |

Point d'attention sur les photos : 30 véhicules × 2 inspections × 5 photos × 25 jours = 7 500 photos par mois et par client. À 300 Ko après compression, environ 2,2 Go par mois et par client. Avec 100 clients, environ 2,6 To par an. Il faut une politique de conservation (par exemple, photos d'inspection sans incident supprimées après 6 mois, photos rattachées à un dossier conservées avec le dossier). ESTIMATION / HYPOTHÈSE, durée de conservation à valider avec le DPO.

---

## 23. Risques

| Risque | Probabilité | Impact | Mesure |
|---|---|---|---|
| Amazon fournit gratuitement un outil équivalent (flotte, inspections, dommages) | Moyenne | Très fort | Se concentrer sur les obligations d'employeur français et être agnostique du donneur d'ordre. Surveiller les annonces Amazon [S1]. |
| Amazon interdit ou restreint l'usage d'outils tiers, ou l'import de ses données | Faible à moyenne | Fort | Ne dépendre d'aucune donnée Amazon pour la valeur principale. Import manuel seulement. |
| Marché Amazon France trop petit | Élevée (déjà constaté) | Fort | Élargissement prévu dès la conception (5.2). |
| Faillite ou perte de contrat des clients | Élevée | Moyen | Churn intégré, diversification, contrats mensuels ou annuels avec paiement mensuel. |
| Chauffeurs qui n'utilisent pas l'application | Moyenne | Très fort | Parcours très court, argument de protection du chauffeur, règle de l'employeur (pas de clés sans inspection), mesure quotidienne pendant les pilotes. |
| Données de mauvaise qualité (kilométrages faux, photos floues) | Élevée | Moyen | Contrôles de cohérence, photo du compteur, relances. |
| Non-conformité RGPD ou droit du travail (surveillance excessive) | Moyenne | Fort | Pas de géolocalisation continue, pas de score global, AIPD type, DPA, avis d'avocat avant lancement. |
| Fuite de données entre clients | Faible | Très fort | Double cloisonnement, tests, audit externe. |
| Dépendance à une personne clé (fondateur connaissant le métier) | Moyenne | Fort | Documentation, associé ou premier salarié du métier. |
| Concurrents américains qui arrivent en France (Hera, etc.) | Moyenne | Moyen | Avance sur le droit français (amendes, Mobilic, paie), hébergement UE, langue. |
| Éditeurs de flotte français qui ajoutent planning et chauffeurs | Moyenne | Moyen | Vitesse, spécialisation sur la rotation quotidienne véhicule-chauffeur. |
| Changement réglementaire (Mobilic, amendes) | Faible | Moyen | Veille, architecture paramétrable. |

---

## 24. Proposition de valeur

Pour les dirigeants de sociétés de livraison en VUL (DSP Amazon d'abord, sous-traitants de tous les réseaux ensuite) qui perdent de l'argent et du temps sur les amendes, les dommages, les documents et les absences, le produit est le registre fiable de "qui conduit quoi, quand, dans quel état", qui transforme ces événements en actions suivies jusqu'au bout. Contrairement aux outils d'Amazon et aux logiciels américains centrés sur la performance de livraison, il couvre les obligations d'employeur et de gestionnaire de flotte en France (désignation du conducteur, validité des permis, contrôle technique, temps de travail via Mobilic, variables de paie), sans GPS intrusif et avec des données hébergées dans l'UE.

Version courte pour un argumentaire : "Chaque amende désignée à temps, chaque dommage prouvé, chaque document à jour. Sans Excel et sans WhatsApp."

À prouver pendant les pilotes, avec des chiffres du client, avant de l'écrire sur un site.

---

## 25. Recommandations finales

1. Ne pas développer tout de suite. Lancer la Phase 1 (entretiens et observation) pendant 6 à 8 semaines. C'est le moyen le moins cher d'éviter de construire un produit que personne ne paie.
2. Recadrer le produit sur les obligations d'employeur et de flotte, pas sur la performance Amazon. L'annonce d'Amazon du 21 septembre 2026 (assistant IA pour la performance des DSP [S1]) confirme que ce terrain sera occupé.
3. Faire de l'historique d'affectation véhicule-chauffeur le cœur technique, et du module amendes l'argument commercial d'ouverture (gain chiffré, simple à comprendre).
4. Concevoir dès le départ pour tous les sous-traitants de livraison en VUL. Vendre d'abord aux DSP Amazon, mais ne jamais coder une dépendance à Amazon.
5. Intégrer Mobilic plutôt que construire un pointage maison. Prendre contact avec l'équipe Mobilic dès la Phase 1.
6. Garder hors du MVP : GPS, paie, optimisation de tournées, IA générative, notation des chauffeurs, messagerie complète.
7. Prévoir un budget d'environ 120 à 180 k€ (ou l'équivalent en temps des fondateurs) jusqu'aux premiers clients payants, et un deuxième temps de 200 à 375 k€ pour la commercialisation, à ne dépenser que si les critères de passage sont atteints.
8. Recruter ou s'associer avec quelqu'un qui a dirigé ou géré un DSP. L'accès au marché et la crédibilité passent par là.
9. Faire valider par un avocat en droit social et un DPO, avant la Phase 3 : information du CSE, retenues pour dommages, désignation, conservation des données, notation.
10. Étapes suivantes si la Phase 1 est concluante : wireframes détaillés, schéma de base de données, contrat d'API, choix définitif de la stack avec l'équipe réelle, plan de tests, puis développement.

### Ce que je n'ai pas pu établir et qu'il faut chercher

- Nombre exact et à jour des DSP Amazon en France et de leurs véhicules.
- Conditions contractuelles d'Amazon pour ses DSP français sur l'usage d'outils tiers et l'export des données (Cortex, scorecard).
- Informations sur Instapack.
- Existence et périmètre d'outils Amazon d'inspection des véhicules en France.
- Fréquence et montant réels des amendes et dommages dans un DSP (seuls des entretiens peuvent l'établir).
- Conditions d'accès des éditeurs à l'API Mobilic et liste des éditeurs partenaires actuels.
- Offres API des émetteurs de cartes carburant.

---

## Sources

Les pages marquées "extrait" n'ont pu être lues que via les extraits de moteur de recherche (accès direct bloqué par le proxy de l'environnement). Leur contenu devra être relu directement avant toute utilisation externe du document.

| Réf. | Source | Contenu utilisé |
|---|---|---|
| S1 | About Amazon, "Amazon invests another $1.9 billion in the Delivery Service Partner program" (2026) : https://www.aboutamazon.com/news/transportation/amazon-dsp-program-investment-2026 ; communiqué Business Wire du 21/09/2026 : https://www.businesswire.com/news/home/20260921920176/en/ ; About Amazon, DSP : https://www.aboutamazon.com/impact/empowerment/delivery-partners (extrait) | 4 500 DSP (2025), 3 500 DSP et 275 000 chauffeurs (2022), assistant IA agentique, traduction en 30 langues, Amazon Delivery App |
| S2 | About Amazon France, "Partenaires de livraison" : https://www.aboutamazon.fr/notre-impact/soutien-a-lentrepreneuriat/partenaires-de-livraison (extrait, date non vérifiée) | Plus de 100 entreprises en France, 27 agences de livraison |
| S3 | Stratégies Logistique, "Amazon cherche 40 partenaires de livraison du dernier km" : https://www.strategies-logistique.com/Amazon-cherche-40-partenaires-de,11169 (extrait) | 40 partenaires recherchés, flottes de 20 à 40 véhicules |
| S4 | L'Informé, "Comment Amazon abandonne discrètement ses transporteurs historiques pour des livreurs 2.0" : https://www.linforme.com/transports-auto/article/comment-amazon-abandonne-discretement-ses-transporteurs-historiques-pour-des-livreurs-2-0_1913.html (extrait) | DSP 2.0, environ 200 € par tournée contre plus de 270 € |
| S5 | Legalstart, "Devenir livreur Amazon" : https://www.legalstart.fr/fiches-pratiques/services-a-la-personne/devenir-livreur-amazon/ ; Amazon, brochure DSP France 2022 : https://m.media-amazon.com/images/G/08/DSP2022/assets/desktop/DSP_Brochure_France_V1.pdf (non consultée) | Investissement de départ évoqué (25 000 €), rôle du DSP, outils fournis par Amazon. Source secondaire. |
| S7 | Rue89 Strasbourg : https://www.rue89strasbourg.com/au-tribunal-de-commerce-la-liquidation-de-fast-despatch-sous-traitant-damazon-enfin-engagee-244397 ; France Bleu : https://www.francebleu.fr/infos/faits-divers-justice/strasbourg-le-sous-traitant-d-amazon-fast-despatch-logistics-en-liquidation-judiciaire-1662398505 (extraits) | Liquidation de Fast Despatch Logistics (2022) |
| S8 | Arcep, Observatoire du courrier et du colis, année 2024 : https://www.arcep.fr/cartes-et-donnees/nos-publications-chiffrees/observatoire-courrier-colis/marches-courrier-colis-activites-connexes-france-2024.html | 1,7 milliard de colis, 10,0 Md€ HT |
| S9 | Fleetio, tarifs : https://www.fleetio.com/pricing (via extrait, confirmé par plusieurs comparatifs) | 4 $, 7 $, 10 $ par véhicule et par mois |
| S10 | Tech.co, Expert Market, comparatifs Samsara : https://tech.co/fleet-management/samsara-fleet-management-review ; https://www.expertmarket.com/fleet-management/samsara-review | 27 à 33 $ par véhicule, boîtier 99 à 148 $ (estimations tierces, prix non publiés) |
| S11 | Hera, tarifs : https://www.hera.app/pricing (extrait) | 9 $ par chauffeur actif et par mois |
| S12 | Sites éditeurs DSP : DailyDSP https://dailydsp.com/ ; LMDmax https://lmdmax.com/industries/amazon-dsp ; DSPilot https://dspilot.co.uk/ ; DSPLite https://dsplite.com/ ; Nizod https://nizod.com/blog/amazon-dsp-dispatch-guide ; DSPGrid (article sur Cortex) (extraits) | Existence et périmètre des concurrents, rôle de Cortex, indicateurs de scorecard |
| S13 | eDriving, Mentor DSP : https://www.edriving.com/amazon-dsp-support/ ; Business Wire (Netradyne, 2022) : https://www.businesswire.com/news/home/20220907005437/en | Télématique de conduite des DSP, expansion de Netradyne en France |
| S14 | CNIL, "La géolocalisation des véhicules des salariés" : https://www.cnil.fr/fr/la-geolocalisation-des-vehicules-des-salaries | Interdiction du contrôle de vitesse, désactivation hors temps de travail |
| S15 | CNIL, durées de conservation de la géolocalisation : https://www.cnil.fr/fr/cnil-direct/question/geolocalisation-des-vehicules-professionnels-des-employes-combien-de-temps-sont ; exemple d'information : https://www.cnil.fr/fr/exemple-dinformation-en-cas-de-geolocalisation-des-vehicules-des-salaries | 2 mois, 1 an, 5 ans ; AIPD ; information des salariés |
| S16 | CNIL, référentiel des durées de conservation RH (avril 2026) : https://www.cnil.fr/fr/referentiel-durees-conservation-donnees-rh | Base active puis archivage, repère de 5 ans après le départ |
| S17 | Ministère des Transports, "Suivi du temps de travail dans le transport léger de marchandises : l'outil Mobilic" : https://www.ecologie.gouv.fr/politiques-publiques/suivi-du-temps-travail-transport-leger-marchandises-loutil-mobilic ; API Mobilic : https://developers.mobilic.beta.gouv.fr/ ; FAQ logiciel tiers : https://faq.mobilic.beta.gouv.fr/usages-et-fonctionnement-de-mobilic-gestionnaire/autoriser-lacces-a-un-logiciel-tiers ; DRIEAT Île-de-France | LIC ou Mobilic obligatoire pour les VUL de moins de 3,5 t, API pour éditeurs |
| S18 | Légifrance, code de la route, art. L121-6 : https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000043341993 ; DREETS Normandie | Désignation du conducteur sous 45 jours, contravention de 4e classe |
| S19 | Légifrance, code pénal, art. 131-41 : https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000006417342 ; analyse Landot avocats (2024) | Quintuplement de l'amende pour les personnes morales ; 450 € minorée, 675 € forfaitaire, 1 875 € majorée (montants cités par une source secondaire, à confirmer) |
| S20 | Ministère de l'Intérieur, ouverture de verif.permisdeconduire.gouv.fr : https://www.interieur.gouv.fr/actualites/communiques-de-presse/ouverture-du-teleservice-verifpermisdeconduiregouvfr ; Code du travail numérique : https://code.travail.gouv.fr/fiche-service-public/un-employeur-peut-il-sinformer-sur-le-permis-de-conduire-de-son-salarie | Vérification de validité du permis par les employeurs du transport routier, art. L225-5 code de la route |
| S21 | Ameli, accident du travail, démarches de l'employeur : https://www.ameli.fr/entreprise/vos-salaries/accident-travail-trajet/demarches ; CCI Paris Île-de-France | Déclaration sous 48 h, amende jusqu'à 3 750 € pour une personne morale |
| S22 | Ministère de la Transition écologique, contrôle technique : https://www.ecologie.gouv.fr/politiques-publiques/controle-technique-vehicules | VUL : premier contrôle avant 4 ans, puis tous les 2 ans, contrôle complémentaire pollution |
| S23 | Silae, API : https://www.silae.fr/api-silae/ ; import de données : https://support.silae.fr/hc/fr/articles/36322827642386--FAQ-Import-de-donn%C3%A9es | API et imports pour éléments variables de paie |
| S24 | Fleeti, intégrations : https://www.fleeti.co/fonctionnalites/integrations ; TotalEnergies Mobility Business ; DKV Mobility | Intégration des cartes carburant (TotalEnergies, Shell, BP, AS24, DKV, UTA) |
| S25 | High Mobility : https://www.high-mobility.com/car-api ; Smartcar : https://smartcar.com/brand/stellantis ; Stellantis Mobilisights : https://www.media.stellantis.com/em-en/mobilisights/press/mobilisights-drives-the-telematic-future-with-integrated-fleet-management-data-package-in-the-my24-pro-one-range | API de données constructeur pour VUL |
| S26 | Comparatifs commerciaux de logiciels de flotte en France (La Fabrique du Net, Mooncard, GAC) : https://www.lafabriquedunet.fr/logiciels/productivite/gestion-flotte | Fourchette de 8 à 28 € par véhicule avec boîtier. Fiabilité moyenne (contenu commercial). |
| S27 | DSP Hire, FAQ recrutement DSP : https://dsphire.com/dsp-recruiting-faq/ | Turnover de 100 à 150 % par an aux États-Unis. Fiabilité faible (vendeur de services), à ne pas citer comme fait établi. |
| S28 | Harnay, "Du contrat de travail au contrat de sous-traitance", séminaire SPLOTT, Université Gustave Eiffel : https://splott.univ-gustave-eiffel.fr/fileadmin/redaction/SPLOTT/archives_seminaire_EPOP/S8_Harnay.pdf (extrait) ; Basta!, "Un système illégal" : https://basta.media/un-systeme-illegal-face-aux-derives-de-la-soustraitance-l-alliance-inedite-entre-livreurs-et-petits-patrons (extrait) | Taux de sous-traitance chez Chronopost, sous-traitants de DPD, pratiques chez GLS et La Poste |
| S29 | Bpifrance Création, "Transport routier de marchandises (véhicules légers)" : https://bpifrance-creation.fr/activites-reglementees/transport-routier-marchandises-vehicules-legers ; Adie, fiche transport de moins de 3,5 t | Inscription au registre, capacité, licence de transport intérieur |
| S30 | Urssaf, travail illégal : https://www.urssaf.fr/accueil/travail-illegal.html | Solidarité financière du donneur d'ordre |
| S31 | Amazon, Solution Provider Acceptable Use Policy (Seller Central) : https://sellercentral.amazon.com/solution-provider/policy?policyType=AUP&locale=en_US (extrait) | Interdiction de contourner les politiques des portails Amazon par des partages manuels ou programmatiques. Concerne les vendeurs, cité par analogie. |
| S32 | Légifrance, code du travail, art. L1331-2 (interdiction des sanctions pécuniaires) : texte à consulter sur legifrance.gouv.fr (lien direct non vérifié) | Pas de retenue sur salaire à titre de sanction. Lien et portée à vérifier par un avocat. |

Contradictions et incertitudes relevées entre sources :
- Taille des flottes : "20 à 40 véhicules" [S3] et "jusqu'à 50 chauffeurs" (source secondaire) sont compatibles ; le chiffre américain "40 à 100 employés" (sources secondaires américaines) suggère des structures plus grosses aux États-Unis.
- Nombre de partenaires en France : "plus de 100" [S2] et "40 nouveaux recherchés" [S3] ne sont pas datés de façon comparable ; on ne peut pas les additionner avec certitude.
- Montants d'amende pour non-désignation : les montants de 450, 675 et 1 875 € proviennent d'une source secondaire ; le principe du quintuplement est, lui, dans le code pénal [S19].
