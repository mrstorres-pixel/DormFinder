<?php

namespace App\Models;

use Database\Factories\ViewingRequestFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['property_id', 'room_option_id', 'student_id', 'landlord_id', 'client_id', 'listing_snapshot', 'requested_start', 'starts_at', 'status', 'student_note', 'owner_note', 'revision'])]
class ViewingRequest extends Model
{
    /** @use HasFactory<ViewingRequestFactory> */
    use HasFactory;

    protected function casts(): array
    {
        return ['listing_snapshot' => 'array', 'starts_at' => 'immutable_datetime', 'requested_start' => 'immutable_datetime', 'revision' => 'integer'];
    }

    public function property(): BelongsTo
    {
        return $this->belongsTo(Property::class);
    }

    public function student(): BelongsTo
    {
        return $this->belongsTo(User::class, 'student_id');
    }

    public function landlord(): BelongsTo
    {
        return $this->belongsTo(User::class, 'landlord_id');
    }
}
