-- =====================================================
--  LATTENTE - Base de datos MySQL (Laragon)
--  Importar en HeidiSQL: Archivo > Cargar archivo SQL > Ejecutar (F9)
--  OJO: borra y vuelve a crear la base "lattente".
-- =====================================================

DROP DATABASE IF EXISTS lattente;
CREATE DATABASE lattente CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE lattente;

-- Categorías del menú
CREATE TABLE categories (
  id INT AUTO_INCREMENT PRIMARY KEY,
  slug VARCHAR(80) NOT NULL UNIQUE,
  name VARCHAR(120) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  image_url VARCHAR(500),
  menu_group VARCHAR(40) NOT NULL DEFAULT 'todos',
  show_on_home BOOLEAN NOT NULL DEFAULT TRUE
);

-- Productos (images guarda una lista JSON de URLs)
CREATE TABLE products (
  id INT AUTO_INCREMENT PRIMARY KEY,
  category_id INT,
  name VARCHAR(150) NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL,
  currency VARCHAR(10) NOT NULL DEFAULT 'Bs.',
  image_url VARCHAR(500),
  images TEXT,
  featured BOOLEAN NOT NULL DEFAULT FALSE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
);

-- Pedidos
CREATE TABLE orders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(150) NOT NULL,
  address VARCHAR(255) NOT NULL,
  quantity INT NOT NULL DEFAULT 1,
  notes TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Detalle de cada pedido
CREATE TABLE order_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_id INT NOT NULL,
  product_id INT,
  product_name VARCHAR(150) NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  quantity INT NOT NULL DEFAULT 1,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
);

-- Calificaciones de clientes
CREATE TABLE feedback (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(150) NOT NULL,
  rating INT NOT NULL,
  comment TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Redes sociales del pie de página (una sola fila, id = 1)
CREATE TABLE redes (
  id INT PRIMARY KEY,
  instagram VARCHAR(255) NOT NULL DEFAULT '',
  facebook VARCHAR(255) NOT NULL DEFAULT '',
  tiktok VARCHAR(255) NOT NULL DEFAULT ''
);

INSERT INTO redes (id, instagram, facebook, tiktok) VALUES (1, '', '', '');

-- ===================== DATOS =====================

INSERT INTO categories (slug, name, sort_order, image_url, menu_group, show_on_home) VALUES
  ('blends', 'BLENDS', 1, 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=800&q=80', 'calientes', TRUE),
  ('chocolates', 'CHOCOLATES', 2, 'https://images.unsplash.com/photo-1542990253-0d0f5be5f0ed?w=800&q=80', 'calientes', TRUE),
  ('bebidas-frias', 'BEBIDAS FRÍAS CON CAFÉ', 3, 'https://images.unsplash.com/photo-1461023058943-07fcbe16d735?w=800&q=80', 'frias', TRUE),
  ('jugos-agua', 'JUGOS CON AGUA', 4, 'https://images.unsplash.com/photo-1622597467836-f3285f2131b8?w=800&q=80', 'frias', TRUE),
  ('jugos-leche', 'JUGOS CON LECHE', 5, 'https://images.unsplash.com/photo-1553530666-ba11a7da3888?w=800&q=80', 'frias', TRUE),
  ('milkshakes', 'MILKSHAKES', 6, 'https://images.unsplash.com/photo-1572490122747-3968b75cc699?w=800&q=80', 'frias', TRUE),
  ('smoothie', 'SMOOTHIE', 7, 'https://images.unsplash.com/photo-1505252585461-04db1eb84625?w=800&q=80', 'frias', TRUE),
  ('iced-tea', 'ICED TEA', 8, 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=800&q=80', 'frias', TRUE),
  ('bolleria', 'BOLLERÍA', 9, 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=800&q=80', 'comida', TRUE),
  ('postres', 'POSTRES DULCES', 10, 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=800&q=80', 'comida', TRUE),
  ('sandwiches', 'SANDWICHES', 11, 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=800&q=80', 'comida', TRUE),
  ('desayunos', 'DESAYUNOS', 12, 'https://images.unsplash.com/photo-1525351484163-7529414344d8?w=800&q=80', 'comida', TRUE),
  ('extras', 'EXTRAS', 13, 'https://images.unsplash.com/photo-1486427944299-d1955d23e34d?w=800&q=80', 'extras', TRUE),
  ('desayunos-especiales', 'DESAYUNOS ESPECIALES', 14, 'https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?w=800&q=80', 'creaciones', TRUE),
  ('cafes-calientes', 'Cafes Calientes', 15, 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=800&q=80', 'creaciones', TRUE),
  ('tes', 'Tés', 16, 'https://images.unsplash.com/photo-1571934811356-5cc061b6821f?w=800&q=80', 'creaciones', TRUE);

INSERT INTO products (category_id, name, description, price, image_url, images, featured)
SELECT id, 'BOX AMOR INFINITO MAMÁ 2026', 'Box especial con jugos, pastelería y detalle floral.', 340.00, 'https://images.unsplash.com/photo-1486427944299-d1955d23e34d?w=800&q=80', '["https://images.unsplash.com/photo-1486427944299-d1955d23e34d?w=800&q=80","https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=800&q=80"]', TRUE FROM categories WHERE slug = 'desayunos-especiales';
INSERT INTO products (category_id, name, description, price, image_url, images, featured)
SELECT id, 'MOM TOTE EDITION', 'Tote con selección de pan artesanal.', 220.00, 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=800&q=80', '["https://images.unsplash.com/photo-1509440159596-0249088772ff?w=800&q=80"]', TRUE FROM categories WHERE slug = 'desayunos-especiales';
INSERT INTO products (category_id, name, description, price, image_url, images, featured)
SELECT id, 'DESAYUNO ESPECIAL 4 (PARA DOS)', 'Desayuno completo pensado para compartir.', 350.00, 'https://images.unsplash.com/photo-1525351484163-7529414344d8?w=800&q=80', '["https://images.unsplash.com/photo-1525351484163-7529414344d8?w=800&q=80","https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?w=800&q=80"]', TRUE FROM categories WHERE slug = 'desayunos-especiales';
INSERT INTO products (category_id, name, description, price, image_url, images, featured)
SELECT id, 'ESPRESSO', 'Bebida corta con sabor equilibrado e intenso.', 20.00, 'https://images.unsplash.com/photo-1510590337019-5ef8d3d32116?w=800&q=80', '["https://images.unsplash.com/photo-1510590337019-5ef8d3d32116?w=800&q=80"]', FALSE FROM categories WHERE slug = 'cafes-calientes';
INSERT INTO products (category_id, name, description, price, image_url, images, featured)
SELECT id, 'MOCCAS', 'Cappuccino con un toque de cacao.', 20.00, 'https://images.unsplash.com/photo-1572442388796-11668a67e53d?w=800&q=80', '["https://images.unsplash.com/photo-1572442388796-11668a67e53d?w=800&q=80"]', FALSE FROM categories WHERE slug = 'cafes-calientes';
INSERT INTO products (category_id, name, description, price, image_url, images, featured)
SELECT id, 'DARK CHAI LATTE', 'Café espresso con especias, servido con espuma de leche.', 20.00, 'https://images.unsplash.com/photo-1578374173705-969cbe6f2d6b?w=800&q=80', '["https://images.unsplash.com/photo-1578374173705-969cbe6f2d6b?w=800&q=80"]', FALSE FROM categories WHERE slug = 'cafes-calientes';
INSERT INTO products (category_id, name, description, price, image_url, images, featured)
SELECT id, 'AMERICANOS', 'Espresso alargado con agua caliente.', 20.00, 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=800&q=80', '["https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=800&q=80"]', FALSE FROM categories WHERE slug = 'cafes-calientes';
INSERT INTO products (category_id, name, description, price, image_url, images, featured)
SELECT id, 'MACCHIATOS', 'Espresso servido con espuma de leche.', 20.00, 'https://images.unsplash.com/photo-1485808191679-5f86510681a2?w=800&q=80', '["https://images.unsplash.com/photo-1485808191679-5f86510681a2?w=800&q=80"]', FALSE FROM categories WHERE slug = 'cafes-calientes';
INSERT INTO products (category_id, name, description, price, image_url, images, featured)
SELECT id, 'LATTES', 'Espresso servido con leche texturizada y espuma ligera.', 20.00, 'https://images.unsplash.com/photo-1561882468-9110e03e0f78?w=800&q=80', '["https://images.unsplash.com/photo-1561882468-9110e03e0f78?w=800&q=80","https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=800&q=80"]', FALSE FROM categories WHERE slug = 'cafes-calientes';
INSERT INTO products (category_id, name, description, price, image_url, images, featured)
SELECT id, 'RED VELVET CUPCAKES', 'Cupcake red velvet con frosting suave.', 36.00, 'https://images.unsplash.com/photo-1614707267537-b85aaf00c4b7?w=800&q=80', '["https://images.unsplash.com/photo-1614707267537-b85aaf00c4b7?w=800&q=80"]', FALSE FROM categories WHERE slug = 'postres';
INSERT INTO products (category_id, name, description, price, image_url, images, featured)
SELECT id, 'KOREAN SALT BREAD', 'Pan salado coreano, horneado fresco.', 45.00, 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=800&q=80', '["https://images.unsplash.com/photo-1509440159596-0249088772ff?w=800&q=80"]', FALSE FROM categories WHERE slug = 'bolleria';
INSERT INTO products (category_id, name, description, price, image_url, images, featured)
SELECT id, 'TE VERDE', 'Té verde suave y aromático.', 18.00, 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=800&q=80', '["https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=800&q=80"]', FALSE FROM categories WHERE slug = 'tes';
INSERT INTO products (category_id, name, description, price, image_url, images, featured)
SELECT id, 'EARL GREY', 'Té negro con bergamota.', 18.00, 'https://images.unsplash.com/photo-1571934811356-5cc061b6821f?w=800&q=80', '["https://images.unsplash.com/photo-1571934811356-5cc061b6821f?w=800&q=80"]', FALSE FROM categories WHERE slug = 'tes';
INSERT INTO products (category_id, name, description, price, image_url, images, featured)
SELECT id, 'CHAMOMILE', 'Infusión floral relajante.', 18.00, 'https://images.unsplash.com/photo-1597481499750-3e6b22637e12?w=800&q=80', '["https://images.unsplash.com/photo-1597481499750-3e6b22637e12?w=800&q=80"]', FALSE FROM categories WHERE slug = 'tes';
INSERT INTO products (category_id, name, description, price, image_url, images, featured)
SELECT id, 'DARK CHAI', 'Especias calientes con leche.', 20.00, 'https://images.unsplash.com/photo-1578374173705-969cbe6f2d6b?w=800&q=80', '["https://images.unsplash.com/photo-1578374173705-969cbe6f2d6b?w=800&q=80"]', FALSE FROM categories WHERE slug = 'tes';
INSERT INTO products (category_id, name, description, price, image_url, images, featured)
SELECT id, 'HOUSE BLEND', 'Mezcla de la casa, notas a cacao.', 22.00, 'https://images.unsplash.com/photo-1447933601403-0c6688de566e?w=800&q=80', '["https://images.unsplash.com/photo-1447933601403-0c6688de566e?w=800&q=80","https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=800&q=80","https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=800&q=80"]', FALSE FROM categories WHERE slug = 'blends';
INSERT INTO products (category_id, name, description, price, image_url, images, featured)
SELECT id, 'MORNING BLEND', 'Perfil suave para empezar el día.', 22.00, 'https://images.unsplash.com/photo-1497935586351-b67a49e012bf?w=800&q=80', '["https://images.unsplash.com/photo-1497935586351-b67a49e012bf?w=800&q=80","https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=800&q=80"]', FALSE FROM categories WHERE slug = 'blends';
INSERT INTO products (category_id, name, description, price, image_url, images, featured)
SELECT id, 'HOT CHOCOLATE', 'Chocolate caliente cremoso.', 22.00, 'https://images.unsplash.com/photo-1542990253-0d0f5be5f0ed?w=800&q=80', '["https://images.unsplash.com/photo-1542990253-0d0f5be5f0ed?w=800&q=80"]', FALSE FROM categories WHERE slug = 'chocolates';
INSERT INTO products (category_id, name, description, price, image_url, images, featured)
SELECT id, 'MOCHA BLANCO', 'Chocolate blanco con espresso.', 24.00, 'https://images.unsplash.com/photo-1578374173705-969cbe6f2d6b?w=800&q=80', '["https://images.unsplash.com/photo-1578374173705-969cbe6f2d6b?w=800&q=80"]', FALSE FROM categories WHERE slug = 'chocolates';
INSERT INTO products (category_id, name, description, price, image_url, images, featured)
SELECT id, 'ICED LATTE', 'Latte frío con hielo.', 24.00, 'https://images.unsplash.com/photo-1461023058943-07fcbe16d735?w=800&q=80', '["https://images.unsplash.com/photo-1461023058943-07fcbe16d735?w=800&q=80"]', FALSE FROM categories WHERE slug = 'bebidas-frias';
INSERT INTO products (category_id, name, description, price, image_url, images, featured)
SELECT id, 'COLD BREW', 'Café de extracción fría.', 26.00, 'https://images.unsplash.com/photo-1517701550927-30cf4ba1dba5?w=800&q=80', '["https://images.unsplash.com/photo-1517701550927-30cf4ba1dba5?w=800&q=80"]', FALSE FROM categories WHERE slug = 'bebidas-frias';
INSERT INTO products (category_id, name, description, price, image_url, images, featured)
SELECT id, 'JUGO DE NARANJA', 'Naranja fresca exprimida.', 16.00, 'https://images.unsplash.com/photo-1622597467836-f3285f2131b8?w=800&q=80', '["https://images.unsplash.com/photo-1622597467836-f3285f2131b8?w=800&q=80"]', FALSE FROM categories WHERE slug = 'jugos-agua';
INSERT INTO products (category_id, name, description, price, image_url, images, featured)
SELECT id, 'JUGO DE FRESA CON LECHE', 'Fresa batida con leche.', 18.00, 'https://images.unsplash.com/photo-1553530666-ba11a7da3888?w=800&q=80', '["https://images.unsplash.com/photo-1553530666-ba11a7da3888?w=800&q=80"]', FALSE FROM categories WHERE slug = 'jugos-leche';
INSERT INTO products (category_id, name, description, price, image_url, images, featured)
SELECT id, 'MILKSHAKE DE VAINILLA', 'Batido cremoso de vainilla.', 28.00, 'https://images.unsplash.com/photo-1572490122747-3968b75cc699?w=800&q=80', '["https://images.unsplash.com/photo-1572490122747-3968b75cc699?w=800&q=80"]', FALSE FROM categories WHERE slug = 'milkshakes';
INSERT INTO products (category_id, name, description, price, image_url, images, featured)
SELECT id, 'SMOOTHIE TROPICAL', 'Mango, piña y banano.', 26.00, 'https://images.unsplash.com/photo-1505252585461-04db1eb84625?w=800&q=80', '["https://images.unsplash.com/photo-1505252585461-04db1eb84625?w=800&q=80"]', FALSE FROM categories WHERE slug = 'smoothie';
INSERT INTO products (category_id, name, description, price, image_url, images, featured)
SELECT id, 'ICED PEACH TEA', 'Té helado de durazno.', 18.00, 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=800&q=80', '["https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=800&q=80"]', FALSE FROM categories WHERE slug = 'iced-tea';
INSERT INTO products (category_id, name, description, price, image_url, images, featured)
SELECT id, 'CROISSANT', 'Croissant mantequilla.', 15.00, 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=800&q=80', '["https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=800&q=80"]', FALSE FROM categories WHERE slug = 'bolleria';
INSERT INTO products (category_id, name, description, price, image_url, images, featured)
SELECT id, 'CHEESECAKE', 'Cheesecake cremoso.', 28.00, 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=800&q=80', '["https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=800&q=80"]', FALSE FROM categories WHERE slug = 'postres';
INSERT INTO products (category_id, name, description, price, image_url, images, featured)
SELECT id, 'CLUB SANDWICH', 'Sandwich clásico de pollo.', 32.00, 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=800&q=80', '["https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=800&q=80"]', FALSE FROM categories WHERE slug = 'sandwiches';
INSERT INTO products (category_id, name, description, price, image_url, images, featured)
SELECT id, 'DESAYUNO CLÁSICO', 'Huevos, pan y café.', 45.00, 'https://images.unsplash.com/photo-1525351484163-7529414344d8?w=800&q=80', '["https://images.unsplash.com/photo-1525351484163-7529414344d8?w=800&q=80"]', FALSE FROM categories WHERE slug = 'desayunos';
INSERT INTO products (category_id, name, description, price, image_url, images, featured)
SELECT id, 'EXTRA SHOT', 'Shot extra de espresso.', 8.00, 'https://images.unsplash.com/photo-1510590337019-5ef8d3d32116?w=800&q=80', '["https://images.unsplash.com/photo-1510590337019-5ef8d3d32116?w=800&q=80"]', FALSE FROM categories WHERE slug = 'extras';
INSERT INTO products (category_id, name, description, price, image_url, images, featured)
SELECT id, 'LECHE VEGETAL', 'Avena, almendra o soya.', 6.00, 'https://images.unsplash.com/photo-1550583724-b2692b85b150?w=800&q=80', '["https://images.unsplash.com/photo-1550583724-b2692b85b150?w=800&q=80"]', FALSE FROM categories WHERE slug = 'extras';
