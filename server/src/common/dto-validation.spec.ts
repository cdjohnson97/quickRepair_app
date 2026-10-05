import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { LoginDto } from '../auth/dto/login.dto.js';
import { CreateBoutiqueDto } from '../boutiques/dto/create-boutique.dto.js';
import { CreateInvoiceDto } from '../reparations/dto/create-invoice.dto.js';
import { CreateReparationDto } from '../reparations/dto/create-reparation.dto.js';
import { UpdateStatusDto } from '../reparations/dto/update-status.dto.js';

// Même configuration que le ValidationPipe global de main.ts (whitelist + transform),
// sans conversion implicite de types : un nombre envoyé en chaîne doit être refusé.
async function invalidFields<T extends object>(cls: new () => T, payload: object): Promise<string[]> {
  const errors = await validate(plainToInstance(cls, payload), { whitelist: true });
  return errors.map((e) => e.property).sort();
}

describe('LoginDto', () => {
  const valid = { email: 'jean@quickrepair.fr', password: 'secret' };

  it('accepte des identifiants bien formés', async () => {
    expect(await invalidFields(LoginDto, valid)).toEqual([]);
  });

  it.each(['pas-un-email', '', 'jean@', '@quickrepair.fr'])("refuse l'email %j", async (email) => {
    expect(await invalidFields(LoginDto, { ...valid, email })).toEqual(['email']);
  });

  it('refuse un mot de passe vide ou absent', async () => {
    expect(await invalidFields(LoginDto, { ...valid, password: '' })).toEqual(['password']);
    expect(await invalidFields(LoginDto, { email: valid.email })).toEqual(['password']);
  });

  it("refuse un mot de passe qui n'est pas une chaîne", async () => {
    expect(await invalidFields(LoginDto, { ...valid, password: 12345 })).toEqual(['password']);
  });

  it('signale tous les champs manquants', async () => {
    expect(await invalidFields(LoginDto, {})).toEqual(['email', 'password']);
  });
});

describe('CreateReparationDto', () => {
  const valid = {
    clientNom: 'Martin',
    clientPrenom: 'Léa',
    clientEmail: 'lea@mail.fr',
    clientTelephone: '0600000000',
    marque: 'Apple',
    modele: 'iPhone 13',
    descriptionPanne: 'Écran cassé',
    idTechnicien: 7
  };

  it('accepte une demande complète', async () => {
    expect(await invalidFields(CreateReparationDto, valid)).toEqual([]);
  });

  it('le téléphone du client est facultatif', async () => {
    const { clientTelephone: _omit, ...withoutPhone } = valid;
    expect(await invalidFields(CreateReparationDto, withoutPhone)).toEqual([]);
  });

  it.each(['clientNom', 'clientPrenom', 'marque', 'modele', 'descriptionPanne'])(
    'refuse %s vide',
    async (field) => {
      expect(await invalidFields(CreateReparationDto, { ...valid, [field]: '' })).toEqual([field]);
    }
  );

  it.each(['clientNom', 'clientPrenom', 'clientEmail', 'marque', 'modele', 'descriptionPanne', 'idTechnicien'])(
    'refuse %s manquant',
    async (field) => {
      const payload: Record<string, unknown> = { ...valid };
      delete payload[field];
      expect(await invalidFields(CreateReparationDto, payload)).toEqual([field]);
    }
  );

  it("refuse un email client invalide (l'upsert du client se fait sur l'email)", async () => {
    expect(await invalidFields(CreateReparationDto, { ...valid, clientEmail: 'lea@' })).toEqual(['clientEmail']);
  });

  it("refuse un idTechnicien envoyé en chaîne ou décimal", async () => {
    expect(await invalidFields(CreateReparationDto, { ...valid, idTechnicien: '7' })).toEqual(['idTechnicien']);
    expect(await invalidFields(CreateReparationDto, { ...valid, idTechnicien: 7.5 })).toEqual(['idTechnicien']);
  });

  it('refuse un téléphone qui n\'est pas une chaîne', async () => {
    expect(await invalidFields(CreateReparationDto, { ...valid, clientTelephone: 600000000 })).toEqual([
      'clientTelephone'
    ]);
  });

  it("ne valide pas les champs inconnus mais le pipe les retire (whitelist)", async () => {
    const instance = plainToInstance(CreateReparationDto, { ...valid, id_statut_actuel: 9, isAdmin: true });
    await validate(instance, { whitelist: true });
    expect(instance).not.toHaveProperty('isAdmin');
    expect(instance).not.toHaveProperty('id_statut_actuel');
  });
});

describe('UpdateStatusDto', () => {
  it('accepte un statut seul', async () => {
    expect(await invalidFields(UpdateStatusDto, { idStatut: 5 })).toEqual([]);
  });

  it('accepte un statut avec commentaire', async () => {
    expect(await invalidFields(UpdateStatusDto, { idStatut: 5, commentaire: 'Pièce reçue' })).toEqual([]);
  });

  it('refuse un statut absent, décimal ou en chaîne', async () => {
    expect(await invalidFields(UpdateStatusDto, {})).toEqual(['idStatut']);
    expect(await invalidFields(UpdateStatusDto, { idStatut: 5.5 })).toEqual(['idStatut']);
    expect(await invalidFields(UpdateStatusDto, { idStatut: '5' })).toEqual(['idStatut']);
  });

  it("refuse un commentaire qui n'est pas une chaîne", async () => {
    expect(await invalidFields(UpdateStatusDto, { idStatut: 5, commentaire: 42 })).toEqual(['commentaire']);
  });
});

describe('CreateInvoiceDto', () => {
  const valid = { montantTotal: 149.9, modePaiement: 'Carte bancaire' };

  it('accepte une facture valide', async () => {
    expect(await invalidFields(CreateInvoiceDto, valid)).toEqual([]);
  });

  it.each([0, -1, -0.01])('refuse le montant %s (doit être strictement positif)', async (montantTotal) => {
    expect(await invalidFields(CreateInvoiceDto, { ...valid, montantTotal })).toEqual(['montantTotal']);
  });

  it('refuse un montant en chaîne ou NaN', async () => {
    expect(await invalidFields(CreateInvoiceDto, { ...valid, montantTotal: '149.9' })).toEqual(['montantTotal']);
    expect(await invalidFields(CreateInvoiceDto, { ...valid, montantTotal: NaN })).toEqual(['montantTotal']);
  });

  it('refuse un mode de paiement absent ou non textuel', async () => {
    expect(await invalidFields(CreateInvoiceDto, { montantTotal: 10 })).toEqual(['modePaiement']);
    expect(await invalidFields(CreateInvoiceDto, { ...valid, modePaiement: 3 })).toEqual(['modePaiement']);
  });
});

describe('CreateBoutiqueDto', () => {
  it('accepte le minimum : un nom', async () => {
    expect(await invalidFields(CreateBoutiqueDto, { nom: 'Lyon' })).toEqual([]);
  });

  it('accepte une boutique complète', async () => {
    expect(
      await invalidFields(CreateBoutiqueDto, {
        nom: 'Lyon',
        ville: 'Lyon',
        adresse: '1 rue A',
        latitude: 45.764,
        longitude: 4.8357
      })
    ).toEqual([]);
  });

  it('refuse un nom vide ou absent', async () => {
    expect(await invalidFields(CreateBoutiqueDto, { nom: '' })).toEqual(['nom']);
    expect(await invalidFields(CreateBoutiqueDto, {})).toEqual(['nom']);
  });

  it.each([
    [90, true],
    [-90, true],
    [90.01, false],
    [-90.01, false]
  ])('latitude %s -> valide=%s', async (latitude, ok) => {
    expect(await invalidFields(CreateBoutiqueDto, { nom: 'X', latitude })).toEqual(ok ? [] : ['latitude']);
  });

  it.each([
    [180, true],
    [-180, true],
    [180.01, false],
    [-180.01, false]
  ])('longitude %s -> valide=%s', async (longitude, ok) => {
    expect(await invalidFields(CreateBoutiqueDto, { nom: 'X', longitude })).toEqual(ok ? [] : ['longitude']);
  });

  it('refuse des coordonnées envoyées en chaîne', async () => {
    expect(await invalidFields(CreateBoutiqueDto, { nom: 'X', latitude: '45.7', longitude: '4.8' })).toEqual([
      'latitude',
      'longitude'
    ]);
  });
});
