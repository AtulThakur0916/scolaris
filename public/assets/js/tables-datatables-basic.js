/**
 * DataTables Basic
 */

'use strict';

let fv, offCanvasEl;
document.addEventListener('DOMContentLoaded', function (e) {
  const table = $('.datatables-users');

  if (table.length) {
    table.DataTable({
      // Options
      order: [[2, 'desc']],
      dom: '<"card-header border-bottom p-3"<"head-label"><"dt-action-buttons text-end"B>><"d-flex justify-content-between align-items-center row"<"col-sm-12 col-md-6"l><"col-sm-12 col-md-6"f>>t<"d-flex justify-content-between row"<"col-sm-12 col-md-6"i><"col-sm-12 col-md-6"p>>',
      displayLength: 7,
      lengthMenu: [7, 10, 25, 50, 75, 100],
      buttons: [
        {
          extend: 'collection',
          className: 'btn btn-label-primary dropdown-toggle me-2',
          text: '<i class="bx bx-export me-sm-1"></i> <span class="d-none d-sm-inline-block">Export</span>',
          buttons: [
            {
              extend: 'print',
              text: '<i class="bx bx-printer me-1" ></i>Print',
              className: 'dropdown-item',
            },
            {
              extend: 'csv',
              text: '<i class="bx bx-file me-1" ></i>Csv',
              className: 'dropdown-item',
            },
            {
              extend: 'excel',
              text: '<i class="bx bx-file me-1" ></i>Excel',
              className: 'dropdown-item',
            },
            {
              extend: 'pdf',
              text: '<i class="bx bx-file me-1" ></i>Pdf',
              className: 'dropdown-item',
            },
            {
              extend: 'copy',
              text: '<i class="bx bx-copy me-1" ></i>Copy',
              className: 'dropdown-item',
            }
          ]
        },
        {
          text: '<i class="bx bx-plus me-sm-1"></i> <span class="d-none d-sm-inline-block">Add New User</span>',
          className: 'create-new btn btn-primary',
          action: function () {
            window.location.href = '/users/create';
          }
        }
      ]
    });
  }
}); 