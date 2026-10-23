import { describe, it, expect } from 'vitest'
import { normalizarCodigo, codigoValido, redondear2, aplicarCupon, type Cupon } from './cupones' // Cambia esto por el nombre de tu archivo

describe('normalizarCodigo', () => {
  it('debe eliminar los espacios en blanco al inicio y al final', () => {
    expect(normalizarCodigo('  HOLA12  ')).toBe('HOLA12')
  })

  it('debe convertir todo el texto a mayúsculas', () => {
    expect(normalizarCodigo('desc12')).toBe('DESC12')
    expect(normalizarCodigo('  abcd99 ')).toBe('ABCD99')
  })

  it('no debe alterar un código que ya está normalizado', () => {
    expect(normalizarCodigo('XMAS23')).toBe('XMAS23')
  })
})

describe('codigoValido', () => {
  it('debe retornar true para códigos válidos (4 letras, 2 números)', () => {
    expect(codigoValido('DESC10')).toBe(true)
    expect(codigoValido('HOLA99')).toBe(true)
  })

  it('debe retornar true para códigos válidos que necesitan normalización', () => {
    expect(codigoValido('  desc10  ')).toBe(true)
  })

  it('debe retornar false para códigos con longitud incorrecta', () => {
    expect(codigoValido('DES10')).toBe(false) // 3 letras
    expect(codigoValido('DESCU10')).toBe(false) // 5 letras
    expect(codigoValido('DESC1')).toBe(false) // 1 número
    expect(codigoValido('DESC100')).toBe(false) // 3 números
  })

  it('debe retornar false para códigos con formato incorrecto', () => {
    expect(codigoValido('1234AB')).toBe(false) // Números primero
    expect(codigoValido('DE12SC')).toBe(false) // Intercalados
    expect(codigoValido('DESC1X')).toBe(false) // Letra al final
    expect(codigoValido('DESC-10')).toBe(false) // Caracteres especiales
  })
})

describe('redondear2', () => {
  it('debe redondear correctamente a dos decimales', () => {
    expect(redondear2(10.554)).toBe(10.55)
    expect(redondear2(10.555)).toBe(10.56)
    expect(redondear2(10.556)).toBe(10.56)
  })

  it('debe manejar correctamente los problemas de precisión de punto flotante (Number.EPSILON)', () => {
    // 1.005 en JS suele ser 1.0049999999999999, por eso se usa EPSILON
    expect(redondear2(1.005)).toBe(1.01)
  })

  it('debe devolver números enteros sin alterar', () => {
    expect(redondear2(100)).toBe(100)
    expect(redondear2(0)).toBe(0)
  })
})

describe('aplicarCupon', () => {
  const hoy = new Date('2026-10-16T12:00:00Z') // Simulamos que hoy es 16 de Octubre de 2026

  const cuponBase: Cupon = {
    codigo: 'DESC20',
    porcentaje: 20,
    topeBs: 50,
    vence: '2026-12-31',
  }

  describe('Casos de error (Validaciones iniciales)', () => {
    it('debe fallar si el precio no es finito o es menor/igual a cero', () => {
      expect(aplicarCupon(0, cuponBase, hoy)).toEqual({
        ok: false,
        motivo: 'El precio original debe ser mayor que cero',
      })
      expect(aplicarCupon(-100, cuponBase, hoy)).toEqual({
        ok: false,
        motivo: 'El precio original debe ser mayor que cero',
      })
      expect(aplicarCupon(Infinity, cuponBase, hoy)).toEqual({
        ok: false,
        motivo: 'El precio original debe ser mayor que cero',
      })
      expect(aplicarCupon(NaN, cuponBase, hoy)).toEqual({
        ok: false,
        motivo: 'El precio original debe ser mayor que cero',
      })
    })

    it('debe fallar si el cupón es null', () => {
      expect(aplicarCupon(100, null, hoy)).toEqual({ ok: false, motivo: 'No hay cupón' })
    })

    it('debe fallar si el código del cupón no cumple el formato', () => {
      const cuponInvalido = { ...cuponBase, codigo: 'INVALIDO' }
      expect(aplicarCupon(100, cuponInvalido, hoy)).toEqual({
        ok: false,
        motivo: 'El código del cupón no es válido',
      })
    })

    it('debe fallar si el cupón está vencido', () => {
      const cuponVencido = { ...cuponBase, vence: '2026-10-15' } // Un día antes de "hoy"
      expect(aplicarCupon(100, cuponVencido, hoy)).toEqual({ ok: false, motivo: 'El cupón venció' })
    })
  })

  describe('Casos de éxito (Aplicación de descuentos)', () => {
    it('debe aplicar el porcentaje de descuento si no supera el tope', () => {
      // Precio 100, dto 20% -> 20Bs de descuento (menor que el tope de 50)
      const resultado = aplicarCupon(100, cuponBase, hoy)
      expect(resultado).toEqual({
        ok: true,
        descuentoBs: 20,
        precioFinal: 80,
      })
    })

    it('debe limitar el descuento al tope establecido (topeBs)', () => {
      // Precio 1000, dto 20% -> 200Bs, pero el tope es 50
      const resultado = aplicarCupon(1000, cuponBase, hoy)
      expect(resultado).toEqual({
        ok: true,
        descuentoBs: 50, // Topado a 50
        precioFinal: 950,
      })
    })

    it('debe permitir aplicar el cupón el mismo día de su vencimiento', () => {
      const cuponMismoDia = { ...cuponBase, vence: '2026-10-16' }
      const resultado = aplicarCupon(100, cuponMismoDia, hoy)
      expect(resultado.ok).toBe(true)
    })

    it('debe redondear a 2 decimales el descuento y el precio final', () => {
      const cuponRaro = { ...cuponBase, porcentaje: 12.345, topeBs: 100 }
      // (150.55 * 12.345) / 100 = 18.5854025 -> redondeado: 18.59
      // Precio final = 150.55 - 18.59 = 131.96
      const resultado = aplicarCupon(150.55, cuponRaro, hoy)
      expect(resultado).toEqual({
        ok: true,
        descuentoBs: 18.59,
        precioFinal: 131.96,
      })
    })

    it('no debe retornar un precio final negativo si el tope supera el precio', () => {
      // Aunque en lógica normal el descuento % es menor, si forzamos algo extraño:
      const cuponAgresivo: Cupon = {
        codigo: 'FREE99',
        porcentaje: 200,
        topeBs: 1000,
        vence: '2026-12-31',
      }
      // Precio 50 -> Descuento bruto = 100. Tope = 1000. Descuento aplicado = 100.
      // Precio final = Math.max(0, 50 - 100) -> 0
      const resultado = aplicarCupon(50, cuponAgresivo, hoy)
      expect(resultado).toEqual({
        ok: true,
        descuentoBs: 100,
        precioFinal: 0, // El límite mínimo es 0
      })
    })
  })
})
