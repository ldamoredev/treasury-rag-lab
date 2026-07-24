---
id: acme-approvals
title: "Aprobaciones de tesorería — Acme"
tenant: acme
version: 1
effectiveFrom: 2026-02-01
---
# Aprobaciones de tesorería — Acme

## Regla específica

Para el cliente Acme, todo pago parcial requiere aprobación humana, independientemente de su importe. La aprobación debe quedar asociada al identificador de la factura y al movimiento bancario correspondiente.

## Autonomía permitida

El asistente puede sugerir la conciliación y preparar el borrador de aplicación. No puede confirmar el asiento, cerrar la factura ni enviar una notificación al cliente sin que una persona apruebe la operación.

## Evidencia mínima

La revisión debe mostrar la referencia bancaria, el importe recibido, el saldo previo y el saldo resultante. Si falta cualquiera de estos datos, la operación debe permanecer pendiente.
