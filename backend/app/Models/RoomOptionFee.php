<?php

namespace App\Models;

use Database\Factories\RoomOptionFeeFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['name', 'frequency', 'amount_centavos'])]
class RoomOptionFee extends Model
{
    /** @use HasFactory<RoomOptionFeeFactory> */
    use HasFactory;

    public $timestamps = false;

    protected function casts(): array
    {
        return ['amount_centavos' => 'integer'];
    }

    public function roomOption(): BelongsTo
    {
        return $this->belongsTo(RoomOption::class);
    }
}
