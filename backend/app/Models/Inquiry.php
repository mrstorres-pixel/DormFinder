<?php

namespace App\Models;

use Database\Factories\InquiryFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable(['student_id', 'landlord_id', 'room_option_id', 'listing_snapshot', 'last_message_at'])]
class Inquiry extends Model
{
    /** @use HasFactory<InquiryFactory> */
    use HasFactory;

    protected function casts(): array
    {
        return ['listing_snapshot' => 'array', 'last_message_at' => 'datetime'];
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

    public function messages(): HasMany
    {
        return $this->hasMany(InquiryMessage::class)->orderBy('id');
    }

    public function canReply(): bool
    {
        return $this->property->status !== 'suspended' && $this->student->status === 'active' && $this->landlord->status === 'active';
    }
}
