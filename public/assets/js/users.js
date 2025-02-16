$(document).ready(function () {
    // Remove the test alert and simple DataTable initialization
    // ... existing code ...


    $.ajax({
        url: '/users/data',
        type: 'POST',
        success: function (response) {
            $('#usersTable').DataTable({
                data: response,
                processing: true,
                serverSide: false,
                dom: '<"row mx-2 py-3"' +
                     '<"col-sm-12 col-md-6"l>' +
                     '<"col-sm-12 col-md-6 text-end"f>>' +
                     '<"table-responsive"t>' +
                     '<"row mx-2"' +
                     '<"col-sm-12 col-md-6"i>' +
                     '<"col-sm-12 col-md-6"p>>',
                pageLength: 10,
                order: [[1, 'asc']], // Order by name column
                columns: [
                    {
                        data: null,
                        title: '#',
                        orderable: false,
                        render: function (data, type, row, meta) {
                            return meta.row + meta.settings._iDisplayStart + 1;
                        }
                    },
                    { data: 'name', title: 'NAME' },
                    { data: 'email', title: 'EMAIL' },
                    {
                        data: null,
                        title: 'ACTIONS',
                        orderable: false,
                        className: 'text-center',
                        render: function (data, type, row) {
                            return `
                                <div class="dropdown">
                                    <button type="button" class="btn p-0 dropdown-toggle hide-arrow" data-bs-toggle="dropdown">
                                        <i class="bx bx-dots-vertical-rounded"></i>
                                    </button>
                                    <div class="dropdown-menu">
                                        <a class="dropdown-item" href="/users/create/${row.id}">
                                            <i class="bx bx-edit-alt me-1"></i> Edit
                                        </a>
                                        <a class="dropdown-item delete-user" href="javascript:void(0)"
                                        data-id="${row.id}">
                                            <i class="bx bx-trash me-1"></i> Delete
                                        </a>
                                    </div>
                                </div>
                            `;
                        }
                    }
                ],
                language: {
                    search: '',
                    searchPlaceholder: "Search...",
                    lengthMenu: '<div class="form-inline">Show <select class="form-select form-select-sm mx-2">'+
                                '<option value="10">10</option>'+
                                '<option value="25">25</option>'+
                                '<option value="50">50</option>'+
                                '<option value="100">100</option>'+
                                '</select> Entries</div>',
                    info: "Showing _START_ to _END_ of _TOTAL_ entries",
                    paginate: {
                        first: '<i class="bx bx-chevrons-left"></i>',
                        previous: '<i class="bx bx-chevron-left"></i>',
                        next: '<i class="bx bx-chevron-right"></i>',
                        last: '<i class="bx bx-chevrons-right"></i>'
                    }
                },
                drawCallback: function () {
                    $('.dataTables_paginate > .pagination').addClass('pagination-rounded');
                }
            });
        },
        error: function (xhr, status, error) {
            console.error('AJAX Error:', {
                status: status,
                error: error,
                response: xhr.responseText
            });
        }
    });

    $(document).on('click', '.delete-user', function() {
        const userId = $(this).data('id');
        confirmDelete(userId);
    });
});


// Add this function to handle delete confirmation
function confirmDelete(userId) {
    Swal.fire({
        title: 'Are you sure?',
        text: "You won't be able to revert this!",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#3085d6',
        cancelButtonColor: '#d33',
        confirmButtonText: 'Yes, delete it!'
    }).then((result) => {
        if (result.isConfirmed) {
            // If user confirms, submit the delete request
            fetch(`/users/delete/${userId}`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json'
                }
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    Swal.fire(
                        'Deleted!',
                        'User has been deleted.',
                        'success'
                    ).then(() => {
                        // Reload the page after deletion
                        window.location.reload();
                    });
                } else {
                    Swal.fire(
                        'Error!',
                        data.message || 'Something went wrong!',
                        'error'
                    );
                }
            })
            .catch(error => {
                Swal.fire(
                    'Error!',
                    'Something went wrong!',
                    'error'
                );
            });
        }
    });
}