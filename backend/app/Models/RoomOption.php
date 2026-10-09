<?php

namespace App\Models;

use Database\Factories\RoomOptionFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

#[Fillable(['name', 'inventory_type', 'price_basis', 'capacity', 'total_units', 'available_units', 'monthly_rent_centavos', 'deposit_centavos', 'advance_months', 'utilities_notes', 'availability_confirmed_at'])]
class RoomOption extends Model
{
    /** @use HasFactory<RoomOptionFactory> */
    use HasFactory, SoftDeletes;

    protected function casts(): array
    {
        return ['availability_confirmed_at' => 'datetime', 'monthly_rent_centavos' => 'integer', 'deposit_centavos' => 'integer', 'capacity' => 'integer', 'total_units' => 'integer', 'available_units' => 'integer', 'advance_months' => 'integer'];
    }

    public function property(): BelongsTo
    {
        return $this->belongsTo(Property::class);
    }

    public function fees(): HasMany
    {
        return $this->hasMany(RoomOptionFee::class)->orderBy('id');
    }
}
