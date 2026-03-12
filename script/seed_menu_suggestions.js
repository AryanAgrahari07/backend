import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

const PREFILLED_ITEMS = [
  // STARTERS - VEG
  { name: "Paneer Tikka", description: "Grilled cottage cheese marinated in tandoori spices and yogurt.", price: 249, image: "https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Hara Bhara Kabab", description: "Spinach and green peas patties with aromatic spices.", price: 189, image: "https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Veg Seekh Kabab", description: "Minced vegetables with spices grilled on skewers.", price: 199, image: "https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Malai Paneer Tikka", description: "Creamy cottage cheese marinated in cheese and spices.", price: 269, image: "https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Tandoori Mushroom", description: "Button mushrooms marinated in tandoori masala.", price: 229, image: "https://images.unsplash.com/photo-1621510456681-2330135e5871?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Achari Paneer Tikka", description: "Cottage cheese with pickle spices grilled in tandoor.", price: 259, image: "https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Tandoori Aloo", description: "Spiced baby potatoes roasted in tandoor.", price: 169, image: "https://images.unsplash.com/photo-1623806649265-6e9e91e07055?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Dahi Ke Kabab", description: "Hung curd patties with spices and herbs.", price: 199, image: "https://images.unsplash.com/photo-1606491956689-2ea866880c84?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Veg Manchurian Dry", description: "Crispy vegetable balls tossed in Indo-Chinese sauce.", price: 179, image: "https://images.unsplash.com/photo-1626074353765-517a681e40be?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Chilli Paneer Dry", description: "Cottage cheese cubes in spicy Indo-Chinese sauce.", price: 229, image: "https://images.unsplash.com/photo-1631452180519-c014fe946bc7?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Gobi Manchurian", description: "Crispy cauliflower florets in tangy sauce.", price: 189, image: "https://images.unsplash.com/photo-1604085792782-8d92f276d7d8?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Spring Rolls", description: "Crispy rolls filled with vegetables and noodles.", price: 159, image: "https://images.unsplash.com/photo-1529042410759-befb1204b468?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Honey Chilli Potato", description: "Crispy potato fingers in honey chilli glaze.", price: 179, image: "https://images.unsplash.com/photo-1573858265339-e7bce0a1b5d1?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Paneer Chilli", description: "Cottage cheese in spicy bell pepper sauce.", price: 239, image: "https://images.unsplash.com/photo-1631452180519-c014fe946bc7?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Veg Crispy", description: "Mixed vegetables in crispy batter with sauce.", price: 199, image: "https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&q=80&w=300&h=300" },

  // STARTERS - NON-VEG
  { name: "Chicken Tikka", description: "Boneless chicken marinated in yogurt and spices.", price: 299, image: "https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Tandoori Chicken", description: "Half chicken marinated in tandoori masala.", price: 349, image: "https://images.unsplash.com/photo-1610057099431-d73a1c9d2f2f?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Chicken Seekh Kabab", description: "Minced chicken with spices grilled on skewers.", price: 279, image: "https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Malai Chicken Tikka", description: "Creamy chicken marinated in cheese and herbs.", price: 329, image: "https://images.unsplash.com/photo-1610057099431-d73a1c9d2f2f?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Achari Chicken Tikka", description: "Chicken pieces marinated in pickle spices.", price: 309, image: "https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Tangdi Kabab", description: "Chicken drumsticks in tandoori marinade.", price: 319, image: "https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Chicken 65", description: "Spicy fried chicken with curry leaves.", price: 279, image: "https://images.unsplash.com/photo-1610057099431-d73a1c9d2f2f?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Chilli Chicken Dry", description: "Crispy chicken in spicy Indo-Chinese sauce.", price: 289, image: "https://images.unsplash.com/photo-1610057099431-d73a1c9d2f2f?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Chicken Lollipop", description: "Fried chicken wingettes in spicy coating.", price: 299, image: "https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Mutton Seekh Kabab", description: "Minced mutton with spices grilled to perfection.", price: 379, image: "https://images.unsplash.com/photo-1529042410759-befb1204b468?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Tandoori Prawns", description: "Large prawns marinated in tandoori spices.", price: 449, image: "https://images.unsplash.com/photo-1559742811-822873691df8?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Fish Tikka", description: "Boneless fish marinated in yogurt and spices.", price: 379, image: "https://images.unsplash.com/photo-1580959375944-ffbe8276d2b4?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Chicken Afghani", description: "Creamy white chicken kababs with mild spices.", price: 339, image: "https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Mutton Boti Kabab", description: "Tender mutton pieces grilled with spices.", price: 399, image: "https://images.unsplash.com/photo-1529042410759-befb1204b468?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Fish Amritsari", description: "Crispy fried fish in gram flour batter.", price: 359, image: "https://images.unsplash.com/photo-1580959375944-ffbe8276d2b4?auto=format&fit=crop&q=80&w=300&h=300" },

  // MAIN COURSE - VEG
  { name: "Paneer Butter Masala", description: "Cottage cheese in rich tomato-based gravy.", price: 269, image: "https://images.unsplash.com/photo-1631452180519-c014fe946bc7?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Kadhai Paneer", description: "Cottage cheese with bell peppers in spicy gravy.", price: 259, image: "https://images.unsplash.com/photo-1631452180519-c014fe946bc7?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Palak Paneer", description: "Cottage cheese in spinach gravy with spices.", price: 249, image: "https://images.unsplash.com/photo-1645177628172-a94c30632395?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Shahi Paneer", description: "Cottage cheese in creamy royal gravy.", price: 279, image: "https://images.unsplash.com/photo-1631452180519-c014fe946bc7?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Paneer Tikka Masala", description: "Grilled cottage cheese in spiced tomato gravy.", price: 289, image: "https://images.unsplash.com/photo-1631452180519-c014fe946bc7?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Paneer Bhurji", description: "Scrambled cottage cheese with onions and spices.", price: 239, image: "https://images.unsplash.com/photo-1631452180519-c014fe946bc7?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Paneer Do Pyaza", description: "Cottage cheese with onions in thick gravy.", price: 259, image: "https://images.unsplash.com/photo-1631452180519-c014fe946bc7?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Paneer Lababdar", description: "Cottage cheese in creamy tomato cashew gravy.", price: 279, image: "https://images.unsplash.com/photo-1631452180519-c014fe946bc7?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Paneer Kolhapuri", description: "Spicy cottage cheese in Kolhapuri style gravy.", price: 269, image: "https://images.unsplash.com/photo-1631452180519-c014fe946bc7?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Paneer Pasanda", description: "Cottage cheese stuffed with dry fruits in gravy.", price: 299, image: "https://images.unsplash.com/photo-1631452180519-c014fe946bc7?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Dal Makhani", description: "Black lentils slow-cooked in creamy tomato gravy.", price: 229, image: "https://images.unsplash.com/photo-1546833999-b9f581a1996d?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Dal Tadka", description: "Yellow lentils tempered with ghee and spices.", price: 189, image: "https://images.unsplash.com/photo-1546833999-b9f581a1996d?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Dal Fry", description: "Mixed lentils with onion and tomato tempering.", price: 179, image: "https://images.unsplash.com/photo-1546833999-b9f581a1996d?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Mix Veg Curry", description: "Seasonal vegetables in spiced gravy.", price: 199, image: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Veg Kolhapuri", description: "Mixed vegetables in spicy Kolhapuri gravy.", price: 219, image: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Kadhai Veg", description: "Mixed vegetables with bell peppers in kadhai masala.", price: 209, image: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Navratan Korma", description: "Nine vegetables and dry fruits in creamy gravy.", price: 249, image: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Malai Kofta", description: "Cottage cheese and potato balls in creamy gravy.", price: 259, image: "https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Dum Aloo Kashmiri", description: "Baby potatoes in rich Kashmiri gravy.", price: 229, image: "https://images.unsplash.com/photo-1589621316382-008455b857cd?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Aloo Gobi", description: "Potato and cauliflower dry curry with spices.", price: 189, image: "https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Baingan Bharta", description: "Roasted eggplant mashed with spices.", price: 199, image: "https://images.unsplash.com/photo-1589621316382-008455b857cd?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Bhindi Masala", description: "Okra cooked with onions and spices.", price: 199, image: "https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Mushroom Masala", description: "Button mushrooms in spicy onion tomato gravy.", price: 229, image: "https://images.unsplash.com/photo-1621510456681-2330135e5871?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Chana Masala", description: "Chickpeas in tangy tomato-based gravy.", price: 179, image: "https://images.unsplash.com/photo-1585937421612-70a008356fbe?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Rajma Masala", description: "Kidney beans in thick tomato gravy.", price: 189, image: "https://images.unsplash.com/photo-1585937421612-70a008356fbe?auto=format&fit=crop&q=80&w=300&h=300" },

  // MAIN COURSE - NON-VEG
  { name: "Butter Chicken", description: "Tender chicken in creamy tomato-based gravy.", price: 329, image: "https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Chicken Tikka Masala", description: "Grilled chicken in spiced tomato gravy.", price: 319, image: "https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Kadhai Chicken", description: "Chicken with bell peppers in kadhai masala.", price: 309, image: "https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Chicken Curry", description: "Traditional chicken curry with home-style spices.", price: 289, image: "https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Chicken Do Pyaza", description: "Chicken with onions in thick gravy.", price: 299, image: "https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Chicken Kolhapuri", description: "Spicy chicken in Kolhapuri style gravy.", price: 319, image: "https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Chicken Lababdar", description: "Chicken in creamy tomato cashew gravy.", price: 329, image: "https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Chicken Handi", description: "Chicken cooked in traditional handi with spices.", price: 309, image: "https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Chicken Bhuna", description: "Dry chicken curry with thick spicy gravy.", price: 299, image: "https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Chicken Keema", description: "Minced chicken with peas and spices.", price: 289, image: "https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Mutton Rogan Josh", description: "Tender mutton in aromatic Kashmiri gravy.", price: 399, image: "https://images.unsplash.com/photo-1529042410759-befb1204b468?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Mutton Curry", description: "Traditional mutton curry with home-style spices.", price: 379, image: "https://images.unsplash.com/photo-1529042410759-befb1204b468?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Kadhai Mutton", description: "Mutton with bell peppers in kadhai masala.", price: 389, image: "https://images.unsplash.com/photo-1529042410759-befb1204b468?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Mutton Do Pyaza", description: "Mutton with onions in thick gravy.", price: 389, image: "https://images.unsplash.com/photo-1529042410759-befb1204b468?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Mutton Kolhapuri", description: "Spicy mutton in Kolhapuri style gravy.", price: 399, image: "https://images.unsplash.com/photo-1529042410759-befb1204b468?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Mutton Keema", description: "Minced mutton with peas and spices.", price: 369, image: "https://images.unsplash.com/photo-1529042410759-befb1204b468?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Fish Curry", description: "Fresh fish in traditional curry gravy.", price: 349, image: "https://images.unsplash.com/photo-1580959375944-ffbe8276d2b4?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Prawn Curry", description: "Large prawns in coastal-style curry.", price: 429, image: "https://images.unsplash.com/photo-1559742811-822873691df8?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Goan Fish Curry", description: "Fish in coconut-based Goan curry.", price: 369, image: "https://images.unsplash.com/photo-1580959375944-ffbe8276d2b4?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Egg Curry", description: "Boiled eggs in spiced onion tomato gravy.", price: 189, image: "https://images.unsplash.com/photo-1582169296194-e4d644c48063?auto=format&fit=crop&q=80&w=300&h=300" },

  // BIRYANI & RICE
  { name: "Chicken Biryani", description: "Fragrant basmati rice layered with spiced chicken.", price: 299, image: "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Mutton Biryani", description: "Aromatic rice with tender mutton pieces.", price: 379, image: "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Veg Biryani", description: "Mixed vegetables with fragrant basmati rice.", price: 229, image: "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Hyderabadi Dum Biryani", description: "Traditional Hyderabadi style slow-cooked biryani.", price: 349, image: "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Paneer Biryani", description: "Cottage cheese with aromatic basmati rice.", price: 269, image: "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Egg Biryani", description: "Boiled eggs layered with fragrant rice.", price: 219, image: "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Prawn Biryani", description: "Succulent prawns with aromatic rice.", price: 399, image: "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Jeera Rice", description: "Basmati rice tempered with cumin seeds.", price: 149, image: "https://images.unsplash.com/photo-1596797038530-2c107229654b?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Steamed Rice", description: "Plain basmati rice steamed to perfection.", price: 129, image: "https://images.unsplash.com/photo-1596797038530-2c107229654b?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Veg Pulao", description: "Aromatic rice with mixed vegetables.", price: 199, image: "https://images.unsplash.com/photo-1596797038530-2c107229654b?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Kashmiri Pulao", description: "Sweet rice with dry fruits and saffron.", price: 229, image: "https://images.unsplash.com/photo-1596797038530-2c107229654b?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Peas Pulao", description: "Basmati rice with green peas and spices.", price: 179, image: "https://images.unsplash.com/photo-1596797038530-2c107229654b?auto=format&fit=crop&q=80&w=300&h=300" },

  // BREADS
  { name: "Tandoori Roti", description: "Whole wheat bread baked in tandoor.", price: 25, image: "https://images.unsplash.com/photo-1585937421612-70a008356fbe?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Butter Tandoori Roti", description: "Whole wheat bread with butter.", price: 30, image: "https://images.unsplash.com/photo-1585937421612-70a008356fbe?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Plain Naan", description: "Leavened bread baked in tandoor.", price: 35, image: "https://images.unsplash.com/photo-1556910585-03ca199fef35?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Butter Naan", description: "Naan brushed with butter.", price: 40, image: "https://images.unsplash.com/photo-1556910585-03ca199fef35?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Garlic Naan", description: "Naan topped with garlic and coriander.", price: 50, image: "https://images.unsplash.com/photo-1556910585-03ca199fef35?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Cheese Naan", description: "Naan stuffed with cheese.", price: 70, image: "https://images.unsplash.com/photo-1556910585-03ca199fef35?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Paneer Naan", description: "Naan stuffed with spiced cottage cheese.", price: 65, image: "https://images.unsplash.com/photo-1556910585-03ca199fef35?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Kashmiri Naan", description: "Sweet naan with dry fruits and coconut.", price: 75, image: "https://images.unsplash.com/photo-1556910585-03ca199fef35?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Keema Naan", description: "Naan stuffed with minced meat.", price: 80, image: "https://images.unsplash.com/photo-1556910585-03ca199fef35?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Pudina Paratha", description: "Layered bread with mint.", price: 45, image: "https://images.unsplash.com/photo-1585937421612-70a008356fbe?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Laccha Paratha", description: "Multi-layered crispy bread.", price: 40, image: "https://images.unsplash.com/photo-1585937421612-70a008356fbe?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Aloo Paratha", description: "Bread stuffed with spiced potatoes.", price: 50, image: "https://images.unsplash.com/photo-1585937421612-70a008356fbe?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Paneer Paratha", description: "Bread stuffed with cottage cheese.", price: 60, image: "https://images.unsplash.com/photo-1585937421612-70a008356fbe?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Gobi Paratha", description: "Bread stuffed with cauliflower.", price: 50, image: "https://images.unsplash.com/photo-1585937421612-70a008356fbe?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Missi Roti", description: "Gram flour bread with spices.", price: 35, image: "https://images.unsplash.com/photo-1585937421612-70a008356fbe?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Rumali Roti", description: "Thin soft bread like handkerchief.", price: 20, image: "https://images.unsplash.com/photo-1585937421612-70a008356fbe?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Kulcha", description: "Leavened bread baked in tandoor.", price: 40, image: "https://images.unsplash.com/photo-1585937421612-70a008356fbe?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Bhatura", description: "Deep-fried leavened bread.", price: 45, image: "https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&q=80&w=300&h=300" },

  // SOUTH INDIAN
  { name: "Masala Dosa", description: "Crispy rice crepe with spiced potato filling.", price: 99, image: "https://images.unsplash.com/photo-1630383249896-424e482df921?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Plain Dosa", description: "Crispy rice and lentil crepe.", price: 79, image: "https://images.unsplash.com/photo-1630383249896-424e482df921?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Mysore Masala Dosa", description: "Spicy dosa with chutney and potato filling.", price: 109, image: "https://images.unsplash.com/photo-1630383249896-424e482df921?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Cheese Dosa", description: "Dosa with cheese filling.", price: 119, image: "https://images.unsplash.com/photo-1630383249896-424e482df921?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Paneer Dosa", description: "Dosa with cottage cheese filling.", price: 129, image: "https://images.unsplash.com/photo-1630383249896-424e482df921?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Paper Dosa", description: "Extra thin and crispy large dosa.", price: 119, image: "https://images.unsplash.com/photo-1630383249896-424e482df921?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Onion Dosa", description: "Dosa with onion topping.", price: 99, image: "https://images.unsplash.com/photo-1630383249896-424e482df921?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Rava Dosa", description: "Crispy semolina crepe.", price: 109, image: "https://images.unsplash.com/photo-1630383249896-424e482df921?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Idli (2 pcs)", description: "Steamed rice cakes with sambhar and chutney.", price: 59, image: "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Medu Vada (2 pcs)", description: "Crispy lentil donuts with sambhar and chutney.", price: 69, image: "https://images.unsplash.com/photo-1606491956689-2ea866880c84?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Sambhar Vada", description: "Lentil donuts soaked in sambhar.", price: 79, image: "https://images.unsplash.com/photo-1606491956689-2ea866880c84?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Idli Vada Combo", description: "2 idli and 1 vada with sambhar and chutney.", price: 89, image: "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Uttapam Plain", description: "Thick rice pancake.", price: 89, image: "https://images.unsplash.com/photo-1630383249896-424e482df921?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Onion Uttapam", description: "Rice pancake with onion topping.", price: 99, image: "https://images.unsplash.com/photo-1630383249896-424e482df921?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Mixed Veg Uttapam", description: "Rice pancake with vegetable topping.", price: 109, image: "https://images.unsplash.com/photo-1630383249896-424e482df921?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Pongal", description: "Rice and lentil comfort food with ghee.", price: 89, image: "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&q=80&w=300&h=300" },

  // BREAKFAST & SNACKS
  { name: "Poha", description: "Flattened rice with peanuts and spices.", price: 69, image: "https://images.unsplash.com/photo-1606491956689-2ea866880c84?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Upma", description: "Semolina porridge with vegetables.", price: 69, image: "https://images.unsplash.com/photo-1606491956689-2ea866880c84?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Pav Bhaji", description: "Mashed vegetable curry with buttered bread.", price: 129, image: "https://images.unsplash.com/photo-1606491956689-2ea866880c84?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Vada Pav", description: "Potato fritter in bread bun.", price: 39, image: "https://images.unsplash.com/photo-1606491956689-2ea866880c84?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Samosa (2 pcs)", description: "Crispy pastry with spiced potato filling.", price: 40, image: "https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Kachori (2 pcs)", description: "Spicy lentil stuffed fried bread.", price: 50, image: "https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Chole Bhature", description: "Spicy chickpea curry with fried bread.", price: 149, image: "https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Aloo Tikki Chaat", description: "Potato patties with yogurt and chutneys.", price: 79, image: "https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Papdi Chaat", description: "Crispy chips with yogurt and chutneys.", price: 79, image: "https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Dahi Puri", description: "Crispy puris filled with yogurt and chutneys.", price: 89, image: "https://images.unsplash.com/photo-1606491956689-2ea866880c84?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Sev Puri", description: "Crispy puris with potato and sev.", price: 79, image: "https://images.unsplash.com/photo-1606491956689-2ea866880c84?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Bhel Puri", description: "Puffed rice with vegetables and chutneys.", price: 69, image: "https://images.unsplash.com/photo-1606491956689-2ea866880c84?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Pani Puri (8 pcs)", description: "Crispy puris with spicy water.", price: 59, image: "https://images.unsplash.com/photo-1606491956689-2ea866880c84?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Raj Kachori", description: "Large kachori with yogurt and chutneys.", price: 99, image: "https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&q=80&w=300&h=300" },

  // CHINESE & INDO-CHINESE
  { name: "Veg Hakka Noodles", description: "Stir-fried noodles with vegetables.", price: 159, image: "https://images.unsplash.com/photo-1585032226651-759b368d7246?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Chicken Hakka Noodles", description: "Stir-fried noodles with chicken.", price: 189, image: "https://images.unsplash.com/photo-1585032226651-759b368d7246?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Schezwan Noodles Veg", description: "Spicy noodles with vegetables.", price: 169, image: "https://images.unsplash.com/photo-1585032226651-759b368d7246?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Schezwan Noodles Chicken", description: "Spicy noodles with chicken.", price: 199, image: "https://images.unsplash.com/photo-1585032226651-759b368d7246?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Veg Fried Rice", description: "Stir-fried rice with vegetables.", price: 149, image: "https://images.unsplash.com/photo-1603133872878-684f208fb84b?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Chicken Fried Rice", description: "Stir-fried rice with chicken.", price: 179, image: "https://images.unsplash.com/photo-1603133872878-684f208fb84b?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Schezwan Fried Rice Veg", description: "Spicy fried rice with vegetables.", price: 159, image: "https://images.unsplash.com/photo-1603133872878-684f208fb84b?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Schezwan Fried Rice Chicken", description: "Spicy fried rice with chicken.", price: 189, image: "https://images.unsplash.com/photo-1603133872878-684f208fb84b?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Triple Schezwan Rice", description: "Rice with noodles and gravy in schezwan sauce.", price: 229, image: "https://images.unsplash.com/photo-1603133872878-684f208fb84b?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "American Chopsuey", description: "Crispy noodles with sweet and sour gravy.", price: 189, image: "https://images.unsplash.com/photo-1585032226651-759b368d7246?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Veg Manchurian Gravy", description: "Vegetable balls in Indo-Chinese gravy.", price: 189, image: "https://images.unsplash.com/photo-1626074353765-517a681e40be?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Chilli Paneer Gravy", description: "Cottage cheese in spicy gravy.", price: 239, image: "https://images.unsplash.com/photo-1631452180519-c014fe946bc7?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Chilli Chicken Gravy", description: "Chicken in spicy Indo-Chinese gravy.", price: 299, image: "https://images.unsplash.com/photo-1610057099431-d73a1c9d2f2f?auto=format&fit=crop&q=80&w=300&h=300" },

  // SOUPS
  { name: "Tomato Soup", description: "Classic tomato soup with herbs.", price: 99, image: "https://images.unsplash.com/photo-1547592166-23ac45744acd?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Hot & Sour Veg Soup", description: "Spicy and tangy vegetable soup.", price: 109, image: "https://images.unsplash.com/photo-1547592166-23ac45744acd?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Hot & Sour Chicken Soup", description: "Spicy and tangy chicken soup.", price: 129, image: "https://images.unsplash.com/photo-1547592166-23ac45744acd?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Sweet Corn Veg Soup", description: "Creamy corn soup with vegetables.", price: 99, image: "https://images.unsplash.com/photo-1547592166-23ac45744acd?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Sweet Corn Chicken Soup", description: "Creamy corn soup with chicken.", price: 119, image: "https://images.unsplash.com/photo-1547592166-23ac45744acd?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Manchow Veg Soup", description: "Spicy soup with crispy noodles.", price: 109, image: "https://images.unsplash.com/photo-1547592166-23ac45744acd?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Manchow Chicken Soup", description: "Spicy chicken soup with crispy noodles.", price: 129, image: "https://images.unsplash.com/photo-1547592166-23ac45744acd?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Lemon Coriander Soup", description: "Tangy soup with fresh coriander.", price: 99, image: "https://images.unsplash.com/photo-1547592166-23ac45744acd?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Dal Shorba", description: "Lentil soup with Indian spices.", price: 109, image: "https://images.unsplash.com/photo-1547592166-23ac45744acd?auto=format&fit=crop&q=80&w=300&h=300" },

  // SALADS
  { name: "Green Salad", description: "Fresh garden vegetables with dressing.", price: 119, image: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Kachumber Salad", description: "Chopped cucumber, tomato, and onion salad.", price: 99, image: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Caesar Salad", description: "Romaine lettuce with caesar dressing.", price: 159, image: "https://images.unsplash.com/photo-1550304943-4f24f54ddde9?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Chicken Caesar Salad", description: "Caesar salad with grilled chicken.", price: 199, image: "https://images.unsplash.com/photo-1550304943-4f24f54ddde9?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Greek Salad", description: "Mediterranean salad with feta cheese.", price: 179, image: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&q=80&w=300&h=300" },

  // RAITA & ACCOMPANIMENTS
  { name: "Boondi Raita", description: "Yogurt with crispy gram flour balls.", price: 79, image: "https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Mix Veg Raita", description: "Yogurt with cucumber, tomato, and onion.", price: 89, image: "https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Pineapple Raita", description: "Sweet yogurt with pineapple chunks.", price: 99, image: "https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Plain Curd", description: "Fresh yogurt.", price: 69, image: "https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Papad Roasted (2 pcs)", description: "Crispy lentil wafers.", price: 30, image: "https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Papad Fried (2 pcs)", description: "Fried lentil wafers.", price: 35, image: "https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Masala Papad", description: "Papad topped with onion, tomato, and spices.", price: 50, image: "https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Green Chutney", description: "Mint and coriander chutney.", price: 20, image: "https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Tamarind Chutney", description: "Sweet and tangy tamarind sauce.", price: 20, image: "https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Mixed Pickle", description: "Assorted Indian pickles.", price: 25, image: "https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Onion Salad", description: "Sliced onions with lemon and spices.", price: 40, image: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&q=80&w=300&h=300" },

  // DESSERTS
  { name: "Gulab Jamun (2 pcs)", description: "Soft milk dumplings in sugar syrup.", price: 79, image: "https://images.unsplash.com/photo-1589985270826-4b7bb135bc9d?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Rasmalai (2 pcs)", description: "Cottage cheese patties in sweetened milk.", price: 99, image: "https://images.unsplash.com/photo-1589985270826-4b7bb135bc9d?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Rasgulla (2 pcs)", description: "Spongy cottage cheese balls in sugar syrup.", price: 79, image: "https://images.unsplash.com/photo-1589985270826-4b7bb135bc9d?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Gajar Ka Halwa", description: "Carrot pudding with nuts.", price: 119, image: "https://images.unsplash.com/photo-1589985270826-4b7bb135bc9d?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Moong Dal Halwa", description: "Lentil pudding with ghee and nuts.", price: 139, image: "https://images.unsplash.com/photo-1589985270826-4b7bb135bc9d?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Kheer", description: "Rice pudding with cardamom and nuts.", price: 99, image: "https://images.unsplash.com/photo-1589985270826-4b7bb135bc9d?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Shahi Tukda", description: "Bread pudding in sweetened milk.", price: 109, image: "https://images.unsplash.com/photo-1589985270826-4b7bb135bc9d?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Kulfi (1 pc)", description: "Traditional Indian ice cream.", price: 69, image: "https://images.unsplash.com/photo-1563805042-7684c019e1cb?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Kulfi Falooda", description: "Kulfi with vermicelli and rose syrup.", price: 129, image: "https://images.unsplash.com/photo-1563805042-7684c019e1cb?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Ice Cream (2 scoops)", description: "Choice of vanilla, chocolate, or strawberry.", price: 89, image: "https://images.unsplash.com/photo-1563805042-7684c019e1cb?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Brownie with Ice Cream", description: "Warm chocolate brownie with vanilla ice cream.", price: 149, image: "https://images.unsplash.com/photo-1624353365286-3f8d62daad51?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Chocolate Lava Cake", description: "Warm cake with molten chocolate center.", price: 159, image: "https://images.unsplash.com/photo-1624353365286-3f8d62daad51?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Jalebi", description: "Crispy sweet spirals in sugar syrup.", price: 89, image: "https://images.unsplash.com/photo-1589985270826-4b7bb135bc9d?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Rabri", description: "Thickened sweet milk with nuts.", price: 109, image: "https://images.unsplash.com/photo-1589985270826-4b7bb135bc9d?auto=format&fit=crop&q=80&w=300&h=300" },

  // BEVERAGES - HOT
  { name: "Masala Chai", description: "Indian spiced tea.", price: 40, image: "https://images.unsplash.com/photo-1597318130921-53e2e3f44e73?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Ginger Tea", description: "Tea with fresh ginger.", price: 45, image: "https://images.unsplash.com/photo-1597318130921-53e2e3f44e73?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Cardamom Tea", description: "Tea with cardamom flavor.", price: 45, image: "https://images.unsplash.com/photo-1597318130921-53e2e3f44e73?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Black Tea", description: "Plain black tea.", price: 35, image: "https://images.unsplash.com/photo-1597318130921-53e2e3f44e73?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Coffee", description: "Filter coffee or espresso-based.", price: 60, image: "https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Cappuccino", description: "Espresso with steamed milk foam.", price: 89, image: "https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Latte", description: "Espresso with steamed milk.", price: 99, image: "https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Hot Chocolate", description: "Rich chocolate drink.", price: 99, image: "https://images.unsplash.com/photo-1542990253-0d0f5be5f0ed?auto=format&fit=crop&q=80&w=300&h=300" },

  // BEVERAGES - COLD
  { name: "Sweet Lassi", description: "Sweet yogurt drink.", price: 79, image: "https://images.unsplash.com/photo-1594631252845-29fc4cc8cde9?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Salted Lassi", description: "Salted yogurt drink.", price: 79, image: "https://images.unsplash.com/photo-1594631252845-29fc4cc8cde9?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Mango Lassi", description: "Yogurt drink with mango.", price: 99, image: "https://images.unsplash.com/photo-1594631252845-29fc4cc8cde9?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Fresh Lime Soda", description: "Fresh lime with soda water.", price: 69, image: "https://images.unsplash.com/photo-1582610116397-edb318620f90?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Fresh Lime Water", description: "Fresh lime with plain water.", price: 59, image: "https://images.unsplash.com/photo-1582610116397-edb318620f90?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Jaljeera", description: "Cumin-flavored refreshing drink.", price: 69, image: "https://images.unsplash.com/photo-1582610116397-edb318620f90?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Masala Chaas", description: "Spiced buttermilk.", price: 69, image: "https://images.unsplash.com/photo-1594631252845-29fc4cc8cde9?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Aam Panna", description: "Raw mango drink.", price: 79, image: "https://images.unsplash.com/photo-1582610116397-edb318620f90?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Cold Coffee", description: "Iced coffee with milk.", price: 99, image: "https://images.unsplash.com/photo-1517487881594-2787fef5ebf7?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Iced Tea", description: "Chilled tea with lemon.", price: 79, image: "https://images.unsplash.com/photo-1556679343-c7306c1976bc?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Fresh Juice - Orange", description: "Freshly squeezed orange juice.", price: 89, image: "https://images.unsplash.com/photo-1600271886742-f049cd451bba?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Fresh Juice - Watermelon", description: "Freshly squeezed watermelon juice.", price: 79, image: "https://images.unsplash.com/photo-1563227812-0ea4c22e6cc8?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Fresh Juice - Mosambi", description: "Sweet lime juice.", price: 79, image: "https://images.unsplash.com/photo-1600271886742-f049cd451bba?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Fresh Juice - Pineapple", description: "Freshly squeezed pineapple juice.", price: 89, image: "https://images.unsplash.com/photo-1589820296156-2454bb8a6ad1?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Mixed Fruit Juice", description: "Blend of seasonal fruits.", price: 99, image: "https://images.unsplash.com/photo-1600271886742-f049cd451bba?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Soft Drink", description: "Choice of cola, sprite, or fanta.", price: 50, image: "https://images.unsplash.com/photo-1554866585-cd94860890b7?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Mineral Water", description: "Bottled water.", price: 30, image: "https://images.unsplash.com/photo-1548839140-29a749e1cf4d?auto=format&fit=crop&q=80&w=300&h=300" },

  // THALIS & COMBOS
  { name: "Veg Thali", description: "2 veg curries, dal, rice, 2 rotis, salad, papad, dessert.", price: 299, image: "https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Special Veg Thali", description: "3 veg curries, paneer, dal, rice, 3 rotis, raita, salad, dessert.", price: 399, image: "https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Non-Veg Thali", description: "Chicken curry, dal, rice, 2 rotis, salad, papad, dessert.", price: 379, image: "https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Special Non-Veg Thali", description: "Chicken + mutton, dal, rice, 3 rotis, raita, salad, dessert.", price: 499, image: "https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Punjabi Thali", description: "Dal makhani, paneer, veg, rice, naan, raita, salad, dessert.", price: 349, image: "https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "South Indian Thali", description: "Sambhar, rasam, 2 curries, rice, curd, papad, pickle.", price: 279, image: "https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Rajasthani Thali", description: "Dal baati churma, gatte ki sabzi, rice, roti, dessert.", price: 369, image: "https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Mini Meals Veg", description: "1 veg curry, dal, rice, 2 rotis, salad.", price: 199, image: "https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Mini Meals Non-Veg", description: "Chicken curry, rice, 2 rotis, salad.", price: 249, image: "https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&q=80&w=300&h=300" },

  // WRAPS & ROLLS
  { name: "Paneer Tikka Roll", description: "Paneer tikka wrapped in paratha.", price: 129, image: "https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Chicken Tikka Roll", description: "Chicken tikka wrapped in paratha.", price: 149, image: "https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Veg Frankie", description: "Mixed vegetables in Indian wrap.", price: 99, image: "https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Chicken Frankie", description: "Chicken in Indian wrap.", price: 119, image: "https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Egg Roll", description: "Egg wrapped in paratha with veggies.", price: 89, image: "https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Paneer Kathi Roll", description: "Paneer in Kolkata-style roll.", price: 119, image: "https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?auto=format&fit=crop&q=80&w=300&h=300" },

  // PIZZA (Indian-style)
  { name: "Margherita Pizza", description: "Classic cheese and tomato pizza.", price: 249, image: "https://images.unsplash.com/photo-1604068549290-dea0e4a305ca?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Paneer Tikka Pizza", description: "Pizza topped with paneer tikka.", price: 299, image: "https://images.unsplash.com/photo-1604068549290-dea0e4a305ca?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Chicken Tikka Pizza", description: "Pizza topped with chicken tikka.", price: 329, image: "https://images.unsplash.com/photo-1604068549290-dea0e4a305ca?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Veggie Supreme Pizza", description: "Mixed vegetables with cheese.", price: 279, image: "https://images.unsplash.com/photo-1604068549290-dea0e4a305ca?auto=format&fit=crop&q=80&w=300&h=300" },

  // SANDWICHES
  { name: "Veg Grilled Sandwich", description: "Grilled sandwich with vegetables.", price: 89, image: "https://images.unsplash.com/photo-1528736235302-52922df5c122?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Cheese Grilled Sandwich", description: "Grilled cheese sandwich.", price: 99, image: "https://images.unsplash.com/photo-1528736235302-52922df5c122?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Paneer Grilled Sandwich", description: "Grilled sandwich with paneer.", price: 119, image: "https://images.unsplash.com/photo-1528736235302-52922df5c122?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Chicken Grilled Sandwich", description: "Grilled sandwich with chicken.", price: 139, image: "https://images.unsplash.com/photo-1528736235302-52922df5c122?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Club Sandwich", description: "Triple-decker sandwich with veggies/chicken.", price: 159, image: "https://images.unsplash.com/photo-1528736235302-52922df5c122?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Bombay Sandwich", description: "Mumbai-style vegetable sandwich.", price: 79, image: "https://images.unsplash.com/photo-1528736235302-52922df5c122?auto=format&fit=crop&q=80&w=300&h=300" },

  // BURGERS
  { name: "Veg Burger", description: "Vegetable patty burger.", price: 89, image: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Cheese Burger", description: "Burger with cheese.", price: 109, image: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Paneer Burger", description: "Spiced paneer patty burger.", price: 119, image: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Chicken Burger", description: "Grilled chicken burger.", price: 139, image: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Aloo Tikki Burger", description: "Potato patty burger.", price: 79, image: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&q=80&w=300&h=300" },

  // PASTA
  { name: "White Sauce Pasta", description: "Creamy white sauce pasta.", price: 189, image: "https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Red Sauce Pasta", description: "Tomato-based pasta.", price: 179, image: "https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Chicken White Sauce Pasta", description: "Creamy chicken pasta.", price: 219, image: "https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Arrabiata Pasta", description: "Spicy tomato sauce pasta.", price: 199, image: "https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?auto=format&fit=crop&q=80&w=300&h=300" },
  { name: "Mac and Cheese", description: "Classic macaroni in cheese sauce.", price: 189, image: "https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?auto=format&fit=crop&q=80&w=300&h=300" },
];

async function seedSuggestions() {
  try {
    // Clear existing
    await pool.query('TRUNCATE TABLE menu_suggestions');
    console.log('Cleared existing suggestions.');

    let count = 0;
    for (const item of PREFILLED_ITEMS) {
      await pool.query(
        `INSERT INTO menu_suggestions (name, description, price, image_url, category, dietary_tags)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [item.name, item.description, item.price, item.image, item.category, item.dietaryTags]
      );
      count++;
    }
    console.log(`Successfully seeded ${count} menu suggestions.`);
  } catch (error) {
    console.error('Error seeding suggestions:', error);
  } finally {
    await pool.end();
  }
}

seedSuggestions();