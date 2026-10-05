import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Roles } from '../decorators/roles.decorator.js';
import { RolesGuard } from './roles.guard.js';

class SampleController {
  @Roles('Responsable')
  managerOnly() {}

  @Roles('Administrateur', 'Responsable')
  adminOrManager() {}

  open() {}
}

@Roles('Administrateur')
class AdminOnlyController {
  inherited() {}

  @Roles('Technicien')
  overridden() {}
}

function contextFor(cls: new () => object, handlerName: string, user?: { role: string }) {
  return {
    getHandler: () => (cls.prototype as any)[handlerName],
    getClass: () => cls,
    switchToHttp: () => ({ getRequest: () => ({ user }) })
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  const guard = new RolesGuard(new Reflector());

  it("laisse passer une route sans @Roles, même sans utilisateur", () => {
    expect(guard.canActivate(contextFor(SampleController, 'open'))).toBe(true);
  });

  it('autorise un utilisateur dont le rôle est requis', () => {
    expect(guard.canActivate(contextFor(SampleController, 'managerOnly', { role: 'Responsable' }))).toBe(true);
  });

  it("autorise n'importe lequel des rôles listés", () => {
    expect(guard.canActivate(contextFor(SampleController, 'adminOrManager', { role: 'Administrateur' }))).toBe(true);
    expect(guard.canActivate(contextFor(SampleController, 'adminOrManager', { role: 'Responsable' }))).toBe(true);
  });

  it("refuse un rôle qui n'est pas dans la liste", () => {
    expect(() => guard.canActivate(contextFor(SampleController, 'managerOnly', { role: 'Technicien' }))).toThrow(
      ForbiddenException
    );
    expect(() =>
      guard.canActivate(contextFor(SampleController, 'adminOrManager', { role: 'Technicien' }))
    ).toThrow(ForbiddenException);
  });

  it("refuse quand aucun utilisateur n'est attaché à la requête", () => {
    expect(() => guard.canActivate(contextFor(SampleController, 'managerOnly'))).toThrow(ForbiddenException);
  });

  it("n'accorde pas de privilège implicite à l'administrateur sur une route réservée aux responsables", () => {
    expect(() =>
      guard.canActivate(contextFor(SampleController, 'managerOnly', { role: 'Administrateur' }))
    ).toThrow(ForbiddenException);
  });

  it('applique le @Roles de la classe quand la méthode n\'en a pas', () => {
    expect(guard.canActivate(contextFor(AdminOnlyController, 'inherited', { role: 'Administrateur' }))).toBe(true);
    expect(() =>
      guard.canActivate(contextFor(AdminOnlyController, 'inherited', { role: 'Technicien' }))
    ).toThrow(ForbiddenException);
  });

  it('le @Roles de la méthode remplace celui de la classe', () => {
    expect(guard.canActivate(contextFor(AdminOnlyController, 'overridden', { role: 'Technicien' }))).toBe(true);
    expect(() =>
      guard.canActivate(contextFor(AdminOnlyController, 'overridden', { role: 'Administrateur' }))
    ).toThrow(ForbiddenException);
  });
});
