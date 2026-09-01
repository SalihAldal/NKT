import { useEffect, useState } from 'react';
import { adminApi } from '../services/admin-api';
import type { AdminCategoryDto } from '../contracts/admin-api';

export function Categories() {
  const [categories, setCategories] = useState<AdminCategoryDto[]>([]);

  useEffect(() => {
    void adminApi.listCategories().then(setCategories);
  }, []);

  const toggleActive = async (id: string, isActive: boolean) => {
    await adminApi.updateCategory(id, { isActive: !isActive });
    setCategories(await adminApi.listCategories());
  };

  return (
    <div>
      <h2>Kategoriler (20 Sabit)</h2>
      <p className="page-desc">Ürün kategorileri silinemez. Yalnızca aktif/pasif ve sıra değiştirilebilir.</p>
      <table className="data-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Ad</th>
            <th>Free</th>
            <th>İçerik</th>
            <th>Hedef</th>
            <th>Yaş</th>
            <th>Durum</th>
            <th>İşlem</th>
          </tr>
        </thead>
        <tbody>
          {categories.map((cat) => (
            <tr key={cat.id} className={cat.warning ? 'warning-row' : ''}>
              <td>{cat.order}</td>
              <td>{cat.name}</td>
              <td>{cat.isFree ? '✓' : '👑'}</td>
              <td>
                {cat.contentCount} / {cat.minimumContentTarget}
                {cat.warning ? ' ⚠' : ''}
              </td>
              <td>{cat.minimumContentTarget}</td>
              <td>{cat.ageRating}</td>
              <td>{cat.isActive ? 'Aktif' : 'Pasif'}</td>
              <td>
                <button type="button" onClick={() => toggleActive(cat.id, cat.isActive)}>
                  {cat.isActive ? 'Pasifleştir' : 'Aktifleştir'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
