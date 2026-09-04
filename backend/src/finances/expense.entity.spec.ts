import { getMetadataArgsStorage } from 'typeorm';
import { Expense } from './expense.entity';

// Defect: expenses.user_id was NOT NULL with ON DELETE CASCADE, so deleting a
// user silently deleted their expense history. Both the column nullability
// and the relation's onDelete must move together (SET NULL cannot apply to a
// NOT NULL column).
describe('Expense entity — user FK no longer cascades money away', () => {
  it('permits a null userId (column is nullable)', () => {
    const column = getMetadataArgsStorage().columns.find(
      (c) => c.target === Expense && c.propertyName === 'userId',
    );
    expect(column).toBeDefined();
    expect(column!.options.nullable).toBe(true);
  });

  it('the user relation no longer cascades deletes onto expenses', () => {
    const relation = getMetadataArgsStorage().relations.find(
      (r) => r.target === Expense && r.propertyName === 'user',
    );
    expect(relation).toBeDefined();
    expect((relation!.options as any).onDelete).toBe('SET NULL');
  });
});
