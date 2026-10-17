-- =============================================================================
-- Códigos curtos para os links comerciais novos (/p/<código>)
--
--   * Links gerados a partir daqui têm 8 caracteres de um alfabeto de 32 símbolos sem
--     os que se confundem ao ler ou digitar (0/o, 1/l): 40 bits aleatórios, cerca de
--     1 trilhão de combinações. Continua impossível adivinhar o link de outra proposta.
--     NÃO é sequencial: o código é a credencial que libera os valores.
--   * Os bits vêm de gen_random_uuid() (gerador criptográfico do Postgres), só dos bytes
--     inteiramente aleatórios do UUID v4 (o 6 e o 8 carregam versão/variante). Cada
--     símbolo usa 5 bits (& 31): sem viés de módulo.
--   * Links já gerados (16 caracteres) e os permanentes (12) não mudam. Unicidade nas
--     duas tabelas continua garantida (laço abaixo + trigger link_code_is_free).
--   * Nada é apagado nem alterado: só a função geradora é substituída.
-- =============================================================================

create or replace function private.new_seller_link_code()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_alphabet constant text := '23456789abcdefghijkmnpqrstuvwxyz';
  v_bytes bytea;
  v_code  text;
  v_index integer;
begin
  loop
    v_bytes := uuid_send(gen_random_uuid());
    v_code := '';
    foreach v_index in array array[0, 1, 2, 3, 4, 5, 7, 9] loop
      v_code := v_code || substr(v_alphabet, (get_byte(v_bytes, v_index) & 31) + 1, 1);
    end loop;
    exit when not exists (select 1 from public.seller_links l where l.code = v_code)
          and not exists (select 1 from public.sellers s where s.code = v_code);
  end loop;
  return v_code;
end;
$$;

comment on function private.new_seller_link_code() is
  'Código público de link comercial novo: 8 caracteres aleatórios (alfabeto sem 0/o/1/l), único em sellers e seller_links.';
