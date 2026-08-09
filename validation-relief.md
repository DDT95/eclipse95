# Validation de la couche nationale de relief

Date du contrôle : 9 août 2026.

## Alignement des méthodes

- Date et heure : 12 août 2026 à 20:19, heure de Paris.
- Soleil : altitude et azimut calculés localement pour chaque cellule.
- Horizon : mêmes distances d’échantillonnage que l’analyse au clic, jusqu’à 10 km.
- Seuils : rouge si marge ≤ 0° ; orange si 0° < marge < 4° ; vert si marge ≥ 4°.
- La couche nationale représente uniquement le relief. La météo est ajoutée dans le score au clic.

## Contrôle du calcul solaire

Comparaison avec SunCalc sur trois points situés dans le nord, le centre et le sud de la France : écart maximal observé d’environ 0,13° sur l’altitude et 0,01° sur l’azimut.

## Contrôle indépendant du relief

Des cellules de chaque couleur ont été recalculées avec l’API d’altitude Open-Meteo utilisée au clic.

- Rouge : 5 cellules testées, 5 masquées au recalcul précis.
- Vert : 5 cellules testées, 5 dégagées au recalcul précis.
- Orange : zone volontairement prudente ; 2 cellules sont restées orange et 3 sont devenues rouges avec le modèle plus précis. Aucune n’est devenue verte.

Le contrôle cible le problème signalé : aucune cellule rouge de l’échantillon n’a produit un relief favorable au recalcul précis.

## Contrôle dans l’application publiée

- Zone rouge testée dans les Alpes, 45.67548 N / 6.19629 E : verdict « Défavorable — Soleil masqué », marge -34,7°.
- Zone verte testée dans le Cotentin, 49.49667 N / -1.75781 E : verdict « Très favorable », marge +10,1°.
- Console du navigateur : aucune erreur pendant les deux parcours complets.

## Limites restantes

La couche d’ouverture reste une grille nationale d’environ 1 km et ne modélise pas les arbres ni les bâtiments. Le résultat au clic reste la référence locale.
